import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { Bone, Group, MathUtils, type Object3D } from 'three';
import { sceneConfig } from './sceneConfig';
type Props = { modelUrl: string; pointer: MutableRefObject<{x:number;y:number}>; reducedMotion: boolean; mobile: boolean; onReady: () => void };
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
export function DeveloperCharacter({ modelUrl, pointer, reducedMotion, mobile, onReady }: Props) {
  const root = useRef<Group>(null);
  const head = useRef<Bone | null>(null);
  const entranceStart = useRef<number | null>(null);
  const { scene, animations } = useGLTF(modelUrl);
  const { actions, names } = useAnimations(animations, root);
  const idleName = useMemo(() => names.find(name => /^idle$/i.test(name)) ?? names.find(name => /idle|stand|breath/i.test(name)), [names]);
  const basePosition = mobile ? sceneConfig.character.mobilePosition : sceneConfig.character.position;
  const scale = mobile ? sceneConfig.character.mobileScale : sceneConfig.character.scale;

  useEffect(() => {
    let candidate: Object3D | undefined;
    scene.traverse(node => { if (!candidate && /^(head|mixamorig:head)$/i.test(node.name) && (node as Bone).isBone) candidate = node; });
    head.current = candidate as Bone | null;
    entranceStart.current = performance.now();
    const action = idleName ? actions[idleName] : undefined;
    const idleTimer = window.setTimeout(() => action?.reset().fadeIn(0.8).play(), reducedMotion ? 0 : sceneConfig.character.entranceDurationMs);
    onReady();
    return () => { window.clearTimeout(idleTimer); action?.fadeOut(0.5); };
  }, [actions, idleName, onReady, reducedMotion, scene]);

  useFrame((_, delta) => {
    if (!root.current) return;
    const motion = reducedMotion ? 1 : easeOutCubic(Math.min(1, (performance.now() - (entranceStart.current ?? performance.now())) / sceneConfig.character.entranceDurationMs));
    const offset = 1 - motion;
    root.current.scale.setScalar(scale * (sceneConfig.character.entranceStartScale + (1 - sceneConfig.character.entranceStartScale) * motion));
    root.current.position.set(basePosition[0], basePosition[1] - (reducedMotion ? 0 : sceneConfig.character.entranceOffsetY * offset), basePosition[2]);
    if (reducedMotion) return;
    const interaction = sceneConfig.interaction;
    root.current.rotation.y = MathUtils.damp(root.current.rotation.y, pointer.current.x * interaction.bodyYawRadians, interaction.pointerDamping, delta);
    root.current.rotation.x = MathUtils.damp(root.current.rotation.x, -pointer.current.y * interaction.bodyPitchRadians, interaction.pointerDamping, delta);
    if (head.current) {
      head.current.rotation.y = MathUtils.damp(head.current.rotation.y, pointer.current.x * interaction.headYawRadians, interaction.headDamping, delta);
      head.current.rotation.x = MathUtils.damp(head.current.rotation.x, -pointer.current.y * interaction.headPitchRadians, interaction.headDamping, delta);
    }
  });

  return <group ref={root} position={basePosition} scale={scale}><primitive object={scene} dispose={null}/></group>;
}
