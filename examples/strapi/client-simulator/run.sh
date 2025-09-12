#!/bin/bash

docker run --network host --rm -i -u $(id -u) grafana/k6 run --vus 10 - <script.js 
