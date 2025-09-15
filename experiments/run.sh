#!/bin/bash

CUR_DIR=$(dirname $0)
CUR_DIR=$(realpath $CUR_DIR)

OUT_DIR=$CUR_DIR/outcomes--$(date -u -Ins)

mkdir $OUT_DIR || exit 1

cd $CUR_DIR/../examples/strapi


for i in $(seq 1 5); do
    echo "starting experiment run $i"
    docker compose down

    sudo rm -f experiment-logs/*

    docker compose run --remove-orphans load-test-strapi | \
        sudo cat >experiment-logs/strapi-k6-results.txt
    mv experiment-logs/activitymonitor-metrics.jsonp experiment-logs/strapi-activitymonitor-metrics.jsonp

    docker compose down

    docker compose run --remove-orphans load-test-graphcl | \
        sudo cat >experiment-logs/graphcl-k6-results.txt
    mv experiment-logs/activitymonitor-metrics.jsonp experiment-logs/graphcl-activitymonitor-metrics.jsonp

    mkdir $OUT_DIR/$i
    cp experiment-logs/*  $OUT_DIR/$i/ || exit 2

done

docker compose down

echo "Experiment completed, you will find the log in $OUT_DIR"
