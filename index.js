'use strict';

const gpxParser = require('gpxparser');
const { Client } = require('hazelcast-client');
const fs = require('fs');
const path = require('path');
const express = require('express');

function readGpx() {
    const gpxText = fs.readFileSync(path.join(__dirname, 'fawaz.gpx'), 'utf8'); // read the gpx file into a variable

    const gpx = new gpxParser(); // create parser obj
    gpx.parse(gpxText); // parse gpx file from string data
    
    // console.log(gpx); // feel free to examine the object here.
    
    const points = [];

    for (const track of gpx.tracks) {
        for (const point of track.points) {
            point.t = point.time;
            delete point.time;
            points.push(point);                     
        }
    }
    
    return points;
}

let client;
let results;
let resultsArray;
let shutdownTriggered = false;

const app = express();

app.get('/', async (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    if (!results) {
        return res.status(500).json({
            message: "Could not retrieve data",
            data: []
        });
    }

    if (!resultsArray) {
        resultsArray = new Array();
        for await (const row of results) {
            resultsArray.push({
                lon: row.lon,
                lat: row.lat,
                ele: row.ele.toNumber(),
                time: row.t.toString()
            });
        }
    }
    
    res.status(200).json({data: resultsArray, message: "ok"});
});

async function shutdown() {
    shutdownTriggered = true;
    if (client) {
        await client.shutdown();
    }
    process.exit(0);
}

process.on('SIGHUP', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
    client = await Client.newHazelcastClient();
    const map = await client.getMap('points');

    await client.getSql().execute(`
        CREATE OR REPLACE MAPPING points (
            __key DOUBLE,
            ele BIGINT,
            lat DOUBLE,
            lon DOUBLE,
            t TIMESTAMP WITH TIME ZONE
            )
        TYPE IMap
        OPTIONS (
            'keyFormat' = 'double',
            'valueFormat' = 'json-flat');
    `);

    const points = readGpx();

    let counter = 0;
    for (const point of points) {
        await map.set(counter, point);
        counter++;
    }

    // actually ORDER BY __key is the same as ORDER BY time (which is the field `t`)
    results = await client.getSql().execute('SELECT * FROM points ORDER BY t ASC');
    console.log(results);
    app.listen(3000, () => {
        console.log('listening on port 3000');
    });
}

main().catch(err => {
    if (shutdownTriggered) {
        return;
    }
    console.error(err);
    process.exit(1);
});
