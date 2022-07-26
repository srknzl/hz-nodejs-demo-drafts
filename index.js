'use strict';

const gpxParser = require('gpxparser');
const fs = require('fs');
const path = require('path');

const gpxText = fs.readFileSync(path.join(__dirname, 'fawaz.gpx'), 'utf8'); // read the gpx file into a variable

const gpx = new gpxParser(); // create parser obj
gpx.parse(gpxText); // parse gpx file from string data

// console.log(gpx); // feel free to examine the object here.

for (const track of gpx.tracks) {
    console.log("Track: " + track.name + "of type " + track.type);
    let pointCounter = 1;
    for (const point of track.points) {
        console.log(`${pointCounter}. Point: ${point.lat}, ${point.lon} Elevation: ${point.ele} Time: ${point.time.toLocaleString('en-US')}`);
        pointCounter++;
    }
}
