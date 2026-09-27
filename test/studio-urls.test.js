import test from 'node:test';
import assert from 'node:assert/strict';
import {demoURL} from '../studio/urls.js';
test('separate Studio builds link to sibling demos; combined and dev builds stay flat',()=>{
 assert.equal(demoURL('wwwzard.html','studio'),'../demos/wwwzard.html');
 assert.equal(demoURL('wwwzard-legacy.html','development'),'./wwwzard-legacy.html');
 assert.equal(demoURL('demos.html','production'),'./demos.html');
});
