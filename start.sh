#!/bin/sh

nohup node $1.js > /dev/null 2>> $1.error.log &
