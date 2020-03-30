#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

node $DIR/autocomplete.js $1 $2 $3;
