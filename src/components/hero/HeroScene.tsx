import { Suspense, useCallback, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { DeveloperCharacter } from './DeveloperCharacter';
import { SceneLoading } from './SceneLoading';
import { sceneConfig } from './sceneConfig';
type Props = { modelUrl: string; reducedMotion: boolean; mobile: boolean };
export function HeroScene({ modelUrl, reducedMotion, mobile }: Props) {
  const pointer = useRef({x:0,y:0});
  const [ready,setReady] = useState(false);
  const markReady = useCallback(() => setReady(true),[]);
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reducedMotion || mobile || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = {x:Math.max(-1,Math.min(1,((event.clientX-rect.left)/rect.width)*2-1)),y:Math.max(-1,Math.min(1,((event.clientY-rect.top)/rect.height)*2-1))};
  };
  const resetPointer = () => { pointer.current = {x:0,y:0}; };
  const lights = sceneConfig.lighting;
  return <div className="hero-canvas" onPointerMove={onPointerMove} onPointerLeave={resetPointer} role="img" aria-label="Three dimensional developer character scene">
    <Canvas dpr={mobile?sceneConfig.quality.mobileDpr:sceneConfig.quality.desktopDpr} camera={{position:sceneConfig.camera.position,fov:sceneConfig.camera.fov}} gl={{alpha:true,antialias:false,powerPreference:'high-performance'}} frameloop={reducedMotion?'demand':'always'}>
      <ambientLight intensity={lights.greenFill.intensity * (mobile ? sceneConfig.quality.mobileLightScale : 1)} color={lights.greenFill.color}/>
      <hemisphereLight intensity={lights.hemisphere.intensity * (mobile ? sceneConfig.quality.mobileLightScale : 1)} color={lights.hemisphere.skyColor} groundColor={lights.hemisphere.groundColor}/>
      <spotLight position={lights.key.position} intensity={lights.key.intensity * (mobile ? sceneConfig.quality.mobileLightScale : 1)} color={lights.key.color} angle={0.68} penumbra={0.8}/>
      <pointLight position={lights.redRim.position} intensity={lights.redRim.intensity * (mobile ? sceneConfig.quality.mobileLightScale : 1)} color={lights.redRim.color} distance={6}/>
      {!mobile && <pointLight position={lights.front.position} intensity={lights.front.intensity} color={lights.front.color} distance={5}/>}
      <Suspense fallback={null}><DeveloperCharacter modelUrl={modelUrl} pointer={pointer} reducedMotion={reducedMotion} mobile={mobile} onReady={markReady}/></Suspense>
    </Canvas>
    {!ready && <div className="canvas-loading"><SceneLoading/></div>}
  </div>;
}
