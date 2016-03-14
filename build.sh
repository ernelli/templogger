#!/bin/sh

mkdir -p public/lib
cp node_modules/requirejs/require.js public/lib
handlebars -a -p -f public/partials.js *.hbar
cp  node_modules/handlebars/dist/handlebars.runtime.js public/
