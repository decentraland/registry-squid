#!/bin/sh
#
# Starts the squid on its own schema, one schema per (ECS service, commit).
#
# A deployment of a commit this service has run before resumes that schema. A new commit gets a new
# schema and a new database user, registered in public.indexers, and indexes from scratch. Reader
# roles come from READER_ROLES (space-separated) so this script carries no consumer list of its own.
#
# Promotion (done by the squid management server, not here) renames the schema to its stable name,
# points this user's search_path at the new name with ALTER USER ... SET search_path, and leaves the
# public.indexers row untouched. This script relies on all three:
#   - the data tables resolve through the user's search_path, which promotion keeps current;
#   - SQUID_SCHEMA is the registered name, which never changes, so the processors' state schemas
#     (<chain>_processor_$SQUID_SCHEMA) keep their names and a restart after promotion resumes them.
#
# The readers can read the state schemas too: each processor's height there is how a reader tells
# whether the squid has indexed a block yet. This script creates them, owned by the deployment user,
# so the grants are in place before the processors create their tables.
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

# Each deployment user has a password of its own, derived from the admin password and the user's
# name: never the admin password itself, nothing has to store it, and the same on every start, so a
# task that starts while the one it replaces still runs does not change the password under it. It is
# hex, so it needs no escaping in SQL or in a URL.
deployment_password() {
  node -e 'process.stdout.write(require("crypto").createHmac("sha256", process.env.DB_PASSWORD).update(process.argv[1]).digest("hex"))' "$1"
}
DEPLOYMENT_PASSWORD=

# Values go to psql as variables (:'name' quotes a literal), never spliced into the SQL text.
psql_admin() {
  psql -t -A -v ON_ERROR_STOP=1 \
    -v service="$SERVICE_NAME" -v commit="$COMMIT_HASH" -v password="$DEPLOYMENT_PASSWORD" \
    --username "$DB_USER" --dbname "$DB_NAME" --host "$DB_HOST" --port "$DB_PORT" "$@"
}

EXISTING_INDEXER=$(psql_admin <<-EOSQL
  SELECT schema, db_user FROM public.indexers
  WHERE service = :'service' AND commit_hash = :'commit'
  ORDER BY created_at DESC LIMIT 1;
EOSQL
)

if [ -n "$EXISTING_INDEXER" ]; then
  NEW_SCHEMA_NAME=$(echo "$EXISTING_INDEXER" | cut -d'|' -f1)
  NEW_DB_USER=$(echo "$EXISTING_INDEXER" | cut -d'|' -f2)
  echo "Resuming schema $NEW_SCHEMA_NAME as $NEW_DB_USER"
  DEPLOYMENT_PASSWORD=$(deployment_password "$NEW_DB_USER")

  psql_admin <<-EOSQL
    ALTER USER "$NEW_DB_USER" WITH PASSWORD :'password';
EOSQL
else
  echo "Creating schema $NEW_SCHEMA_NAME and user $NEW_DB_USER"
  DEPLOYMENT_PASSWORD=$(deployment_password "$NEW_DB_USER")

  # The processors' state schemas, as src/<chain>/main.ts names them.
  STATE_SCHEMAS="ethereum_processor_$NEW_SCHEMA_NAME polygon_processor_$NEW_SCHEMA_NAME"
  STATE=""
  for SCHEMA in $STATE_SCHEMAS; do
    STATE="$STATE
    CREATE SCHEMA $SCHEMA AUTHORIZATION $NEW_DB_USER;"
  done

  GRANTS=""
  for ROLE in $READER_ROLES; do
    for SCHEMA in $NEW_SCHEMA_NAME $STATE_SCHEMAS; do
      GRANTS="$GRANTS
    GRANT USAGE ON SCHEMA $SCHEMA TO \"$ROLE\";
    ALTER DEFAULT PRIVILEGES FOR ROLE $NEW_DB_USER IN SCHEMA $SCHEMA GRANT SELECT ON TABLES TO \"$ROLE\";"
    done
  done

  # One transaction: a failed grant (a misspelled reader role, say) rolls back the schema and the
  # user too, instead of leaving them behind unregistered.
  psql_admin <<-EOSQL
    BEGIN;
    CREATE SCHEMA $NEW_SCHEMA_NAME;
    CREATE USER $NEW_DB_USER WITH PASSWORD :'password';
    GRANT ALL PRIVILEGES ON SCHEMA $NEW_SCHEMA_NAME TO $NEW_DB_USER;
    GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO $NEW_DB_USER;
    ALTER USER $NEW_DB_USER SET search_path TO $NEW_SCHEMA_NAME;
    GRANT $NEW_DB_USER TO "$DB_USER";
    $STATE
    $GRANTS
    INSERT INTO public.indexers (service, schema, db_user, created_at, commit_hash)
    VALUES (:'service', '$NEW_SCHEMA_NAME', '$NEW_DB_USER', NOW(), :'commit');
    COMMIT;
EOSQL
fi

unset PGPASSWORD

export DB_URL=postgresql://$NEW_DB_USER:$DEPLOYMENT_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
# SQUID_SCHEMA, never DB_SCHEMA: typeorm-config would pin search_path per connection to the name
# that promotion retires. See the promotion contract at the top of this file.
export SQUID_SCHEMA=$NEW_SCHEMA_NAME
unset DB_SCHEMA
export DB_USER=$NEW_DB_USER
export DB_PASS=$DEPLOYMENT_PASSWORD

echo "Starting squid services on $SQUID_SCHEMA..."
exec sqd run:registry --node-options="${NODE_OPTIONS:-}"
