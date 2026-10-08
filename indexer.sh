#!/bin/sh
#
# Starts the squid on its own schema, one schema per (ECS service, commit).
#
# A deployment of a commit this service has run before resumes that schema. A new commit gets a new
# schema and a new database user, registered in public.indexers, and indexes from scratch; a
# promotion later renames the schema to its stable name. Reader roles come from READER_ROLES
# (space-separated) so this script carries no consumer list of its own.
#
# Every step fails closed: starting on a schema nobody registered, or creating a fresh schema
# because a lookup failed, would reindex from scratch on every restart.

set -eu

CURRENT_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
NEW_SCHEMA_NAME="registry_squid_${CURRENT_TIMESTAMP}"
NEW_DB_USER="registry_squid_user_${CURRENT_TIMESTAMP}"
COMMIT_HASH=${COMMIT_HASH:-local}
READER_ROLES=${READER_ROLES:-}

echo "Commit hash: $COMMIT_HASH"

if [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ] || [ -z "${DB_PASSWORD:-}" ] || [ -z "${DB_HOST:-}" ] || [ -z "${DB_PORT:-}" ]; then
  echo "Error: DB_USER, DB_NAME, DB_PASSWORD, DB_HOST and DB_PORT must be set."
  exit 1
fi

export PGPASSWORD=$DB_PASSWORD

TASK_METADATA=$(curl -sf "$ECS_CONTAINER_METADATA_URI_V4/task")
CLUSTER=$(echo "$TASK_METADATA" | jq -r '.Cluster')
TASK_ID=$(echo "$TASK_METADATA" | jq -r '.TaskARN' | awk -F'/' '{print $NF}')
SERVICE_GROUP=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ID" --query 'tasks[0].group' --output text)
SERVICE_NAME=$(echo "$SERVICE_GROUP" | sed 's|service:||')

if [ -z "$SERVICE_NAME" ] || [ "$SERVICE_NAME" = "None" ]; then
  echo "Error: could not resolve the ECS service name (got '$SERVICE_NAME')."
  exit 1
fi

echo "Service name: $SERVICE_NAME"

EXISTING_INDEXER=$(psql -t -A -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" --host "$DB_HOST" --port "$DB_PORT" <<-EOSQL
  SELECT schema, db_user FROM public.indexers
  WHERE service = '$SERVICE_NAME' AND commit_hash = '$COMMIT_HASH'
  ORDER BY created_at DESC LIMIT 1;
EOSQL
)

if [ -n "$EXISTING_INDEXER" ]; then
  NEW_SCHEMA_NAME=$(echo "$EXISTING_INDEXER" | cut -d'|' -f1)
  NEW_DB_USER=$(echo "$EXISTING_INDEXER" | cut -d'|' -f2)
  echo "Resuming schema $NEW_SCHEMA_NAME as $NEW_DB_USER"
else
  echo "Creating schema $NEW_SCHEMA_NAME and user $NEW_DB_USER"

  GRANTS=""
  for ROLE in $READER_ROLES; do
    GRANTS="$GRANTS
    GRANT USAGE ON SCHEMA $NEW_SCHEMA_NAME TO $ROLE;
    ALTER DEFAULT PRIVILEGES FOR ROLE $NEW_DB_USER IN SCHEMA $NEW_SCHEMA_NAME GRANT SELECT ON TABLES TO $ROLE;"
  done

  # One transaction: a failed grant (a misspelled reader role, say) rolls back the schema and the
  # user too, instead of leaving them behind unregistered.
  psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" --host "$DB_HOST" --port "$DB_PORT" <<-EOSQL
    BEGIN;
    CREATE SCHEMA $NEW_SCHEMA_NAME;
    CREATE USER $NEW_DB_USER WITH PASSWORD '$DB_PASSWORD';
    GRANT ALL PRIVILEGES ON SCHEMA $NEW_SCHEMA_NAME TO $NEW_DB_USER;
    GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $NEW_DB_USER;
    ALTER USER $NEW_DB_USER SET search_path TO $NEW_SCHEMA_NAME;
    GRANT $NEW_DB_USER TO $DB_USER;
    $GRANTS
    INSERT INTO public.indexers (service, schema, db_user, created_at, commit_hash)
    VALUES ('$SERVICE_NAME', '$NEW_SCHEMA_NAME', '$NEW_DB_USER', NOW(), '$COMMIT_HASH');
    COMMIT;
EOSQL
fi

unset PGPASSWORD

export DB_URL=postgresql://$NEW_DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
# SQUID_SCHEMA, never DB_SCHEMA: typeorm-config would pin search_path per connection, and the pin
# goes stale when the promotion renames this schema. The role's default search_path stays
# authoritative instead.
export SQUID_SCHEMA=$NEW_SCHEMA_NAME
unset DB_SCHEMA
export DB_USER=$NEW_DB_USER
export DB_PASS=$DB_PASSWORD

echo "Starting squid services on $SQUID_SCHEMA..."
exec sqd run:registry --node-options="${NODE_OPTIONS:-}"
