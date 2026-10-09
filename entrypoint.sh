#!/bin/sh

if [ -z "$DB_USER" ] || [ -z "$DB_NAME" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
  echo "Error: DB_USER, DB_NAME, DB_PASSWORD, DB_HOST and DB_PORT must be set."
  exit 1
fi

export DB_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

if [ "$SQUID_ENABLED" = "true" ]; then
  echo "Starting the indexers and the GraphQL API..."
  exec ./indexer.sh
else
  echo "Starting the GraphQL API..."
  exec sqd serve:prod
fi
