import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const scratch=process.env.SCRATCH_DIR;
if(!scratch)throw Error('Run through the SSD development wrapper');
const root=resolve('.'),consumer=resolve(scratch,'consumer');
const {version}=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
await mkdir(consumer,{recursive:true});
const spec=process.argv[2]??'latest';
await writeFile(consumer+'/package.json',JSON.stringify({private:true,type:'module',dependencies:{'@uiwwsw/stackflow-next':spec,next:'16.4.6',react:'19.3.1','react-dom':'19.3.1','@types/react':'^19.3.0','@types/react-dom':'^19.3.0'}}));
execFileSync('npm',['install','--ignore-scripts','--prefer-online'],{cwd:consumer,stdio:'inherit'});
const pkg=JSON.parse(await readFile(consumer+'/node_modules/@uiwwsw/stackflow-next/package.json','utf8'));
if(pkg.version!==version)throw Error(`Expected ${version}, installed ${pkg.version}`);
await writeFile(consumer+'/consumer.tsx',`
import { StackflowProvider, StackLoading, StackLink, useStackRouter, type RouteTransition } from '@uiwwsw/stackflow-next';
import { withStackflow } from '@uiwwsw/stackflow-next/config';
import '@uiwwsw/stackflow-next/style.css';

export const config = withStackflow({ basePath: '/app' });
const map = '/detail?panel=map';
const routes: RouteTransition[] = [{ href: map, animation: 'modal' }];

function Controls() {
  const router = useStackRouter();
  return <><StackLink href={map}>Map</StackLink><button onClick={() => router.back()}>Back</button></>;
}

export function Consumer() {
  return <StackflowProvider
    transitionRoutes={routes}
    skeletonRoutes={[map]}
    fixedTargets={{ selector: '[data-app-fixed]', exceptRoutes: [map] }}
    scrollTarget="[data-app-scroll]"
  >
    <main data-app-scroll><Controls /><StackLoading /><div data-app-fixed>Player</div></main>
  </StackflowProvider>;
}
`);
execFileSync(process.execPath,[root+'/node_modules/typescript/bin/tsc','--noEmit','--module','ESNext','--moduleResolution','Bundler','--jsx','react-jsx','--target','ES2022','--lib','ES2022,DOM,DOM.Iterable','--skipLibCheck','consumer.tsx'],{cwd:consumer,stdio:'inherit'});
await rm(consumer,{recursive:true,force:true});
console.log(`Verified ${pkg.version} installation and TypeScript consumer.`);
