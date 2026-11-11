import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { withStackflow } from '../../dist/config.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export default withStackflow({ distDir:process.env.STACKFLOW_NEXT_BUILD_DIR||'.next', webpack(config){config.resolve.alias['@uiwwsw/stackflow-next/style.css']=path.join(root,'src/next/style.css');config.resolve.alias['@uiwwsw/stackflow-next$']=path.join(root,'dist/index.js');return config;} });
