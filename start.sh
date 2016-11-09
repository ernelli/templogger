#!/bin/sh

echo `date`" Starting $1 " >> $1.error.log

nohup node $1.js > /dev/null 2>> $1.error.log &
