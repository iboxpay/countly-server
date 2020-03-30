#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"

if [ "$1" != "combined" ]; then
    #upgrade existing plugins
    countly plugin upgrade push
    
    #enable new plugins
    countly plugin enable compliance-hub
fi

#remove stuck push collections
node $DIR/upgrade/18.01.1/scripts/push_clear.js

#add indexes
node $DIR/scripts/add_indexes.js
