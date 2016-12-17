#!/bin/bash

HANDLEBARS=`which hanlebars`
if [[ $HANDLEBARS == "" ]]; then
    HANDLEBARS=node_modules/handlebars/bin/handlebars
fi

mkdir -p public/lib
cp node_modules/requirejs/require.js public/lib
$HANDLEBARS -a -p -f public/partials.js *.hbar
cp  node_modules/handlebars/dist/handlebars.runtime.js public/
