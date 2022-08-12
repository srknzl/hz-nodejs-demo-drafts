'use strict';

const gpxParser = require('gpxparser');
const { Client } = require('hazelcast-client');
const fs = require('fs');
const path = require('path');


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

async function main() {
    const client = await Client.newHazelcastClient();
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
    const result = await client.getSql().execute('SELECT * FROM points ORDER BY t ASC');
    
    for await (const row of result) {
        // print row
        console.log(`long: ${row.lon}, lat: ${row.lat}, elevation: ${row.ele}, time: ${row.t}`);
    }
    await client.shutdown();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
