#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

node $DIR/../../scripts/add_indexes.js;
node $DIR/../../scripts/install_plugins.js;