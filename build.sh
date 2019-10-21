#!/usr/bin/env bash
mkdir -p build build/js build/css

tsc -p ./tsconfig.json

cp ./*.html ./build/
cp ./css/*.css ./build/css
cp ./favicon.ico ./build/favicon.ico
cp ./favicon.png ./build/favicon.png

if [ "$1" ]; then
  cp -r ./build/ "$1"
fi
