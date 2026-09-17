import fs from 'node:fs';
import {addResponseProfile} from '../examples/character-profiles.js';
import {assertDocument} from '../src/schema.js';
for(const id of ['ona','wwwzard','rusty']){const path=`examples/characters/${id}.json`;fs.writeFileSync(path,JSON.stringify(assertDocument(addResponseProfile(JSON.parse(fs.readFileSync(path)))),null,2)+'\n');}
