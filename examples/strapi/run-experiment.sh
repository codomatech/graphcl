#!/bin/bash

docker compose down
sudo rm experiment-logs/*

docker compose up load-test-strapi | sudo tail -n 100 >experiment-logs/strapi-k6-results.txt
mv experiment-logs/activitymonitor-metrics.jsonp experiment-logs/strapi-activitymonitor-metrics.jsonp

docker compose down

docker compose up load-test-graphcl | sudo tail -n 100 >experiment-logs/graphcl-k6-results.txt
mv experiment-logs/activitymonitor-metrics.jsonp experiment-logs/graphcl-activitymonitor-metrics.jsonp

docker compose down
echo "Experiment completed, you will find the log in $PWD/experiment-logs"
