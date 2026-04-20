#!/bin/zsh
# scripts/03_hdfs_upload.sh
source ~/.zshrc
 
LOCAL="data/raw/bengaluru/bengaluru_combined.csv"
HDFS_PATH="/weather/raw/bengaluru/bengaluru_combined.csv"
 
echo "Checking HDFS is running..."
hdfs dfsadmin -report | head -5
 
echo "Uploading to HDFS..."
hdfs dfs -put -f $LOCAL $HDFS_PATH
 
echo "Verifying upload..."
hdfs dfs -ls /weather/raw/bengaluru/
hdfs dfs -du -h /weather/raw/bengaluru/
 
echo "Preview first 3 lines from HDFS:"
hdfs dfs -cat $HDFS_PATH | head -3
