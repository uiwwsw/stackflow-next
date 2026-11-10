import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.'),destination=resolve('distribution/demo-source');
const pkg=JSON.parse(await readFile('package.json','utf8'));
await mkdir(destination+'/vendor',{recursive:true});
await rm(destination+'/node_modules/@uiwwsw/stackflow-next',{recursive:true,force:true});
await rm(destination+'/package-lock.json',{force:true});
await cp('examples/next-app/app',destination+'/app',{recursive:true});
await cp('examples/next-app/public',destination+'/public',{recursive:true});
const tarball=`uiwwsw-stackflow-next-${pkg.version}.tgz`;
await cp(`distribution/${tarball}`,destination+`/vendor/${tarball}`);
await cp(`distribution/${tarball}`,destination+'/public/stackflow-next-'+pkg.version+'.tgz');
await writeFile(destination+'/package.json',JSON.stringify({name:'stackflow-next-demo',private:true,type:'module',scripts:{build:'next build --webpack',dev:'next dev --webpack'},dependencies:{'@uiwwsw/stackflow-next':`file:vendor/${tarball}`,next:'16.4.6',react:'19.3.1','react-dom':'19.3.1'},devDependencies:{typescript:'^7.0.2','@types/react':'^19.3.0','@types/react-dom':'^19.3.0','@types/node':'^26.6.6'}},null,2));
await writeFile(destination+'/next.config.mjs','export default {cacheComponents:true,partialPrefetching:true};\n');
await writeFile(destination+'/tsconfig.json',JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],skipLibCheck:true,strict:true,noEmit:true,module:'esnext',esModuleInterop:true,moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}]},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']},null,2));
await writeFile(destination+'/.vercelignore','node_modules\n.next\n.env*\n');
await writeFile(destination+'/vercel.json',JSON.stringify({framework:'nextjs',installCommand:'npm install --ignore-scripts',buildCommand:'npm run build'}));
// Vercel linking metadata contains identifiers, never credential values.
try {await mkdir(destination+'/.vercel',{recursive:true});await cp('.vercel/project.json',destination+'/.vercel/project.json');}catch{}
console.log('Prepared standalone demo consuming the package archive.');
