import { morphSpaceFaults, resolveMorph } from '../src/experiments/wonderland-terrain/creatureMorph';
const faults = morphSpaceFaults(684);
const sample = resolveMorph({worldSeed:684,creatureSeed:11,axes:{bulk:.5,depth:.5,stature:.5,crown:1,hornType:'paired',branches:3}}).morph;
const slim = resolveMorph({worldSeed:684,creatureSeed:11,axes:{bulk:.5,depth:0,stature:.5,crown:.5,hornType:'paired',branches:2}}).morph;
const full = resolveMorph({worldSeed:684,creatureSeed:11,axes:{bulk:.5,depth:1,stature:.5,crown:.5,hornType:'paired',branches:2}}).morph;
const independentDepth = full.torso.up > slim.torso.up && full.torso.across > slim.torso.across
  && full.torso.along === slim.torso.along && full.foot.hip === slim.foot.hip;
console.log(JSON.stringify({faults:faults.slice(0,10),count:faults.length,crownHeight:sample.crownHeight,independentDepth,slim:slim.torso,full:full.torso}));
if(faults.length || !independentDepth) process.exitCode=1;
