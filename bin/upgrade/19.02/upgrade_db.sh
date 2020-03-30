#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"
CUR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ "$1" != "combined" ]; then
    #upgrade plugins
    countly plugin upgrade retention_segments
    countly plugin upgrade alerts
    countly plugin upgrade push
    countly plugin upgrade assistant
    countly plugin upgrade attribution
    countly plugin upgrade crashes
    countly plugin upgrade flows
    countly plugin upgrade plugin-upload
    countly plugin upgrade views
    
    #enable new plugins
    countly plugin enable remote-config
fi

countly config "views.view_limit" 50000

#run upgrade scripts
node $CUR/scripts/change_alerts_schedule.js
node $CUR/scripts/clear_jobs.js
node $CUR/scripts/drop_sessions.js
node $CUR/scripts/fix_report_manager.js
node $CUR/scripts/updateViews.js

#add indexes
node $DIR/scripts/add_indexes.js
