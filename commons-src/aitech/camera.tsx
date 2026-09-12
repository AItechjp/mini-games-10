import {createRoot} from 'react-dom/client';
import AuthGate from './auth-gate';
const camera=document.getElementById('camera-site')!;
createRoot(document.getElementById('camera-auth')!).render(<AuthGate onReady={()=>{camera.hidden=false;document.getElementById('camera-auth')!.classList.add('camera-auth-ready')}}/>);
