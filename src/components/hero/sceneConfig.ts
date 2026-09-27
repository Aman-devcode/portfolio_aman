export const sceneConfig = {
  camera: { position: [0, 0.05, 4.8] as [number, number, number], fov: 34 },
  character: {
    position: [0.08, -1.25, 0] as [number, number, number],
    scale: 1.65,
    mobilePosition: [0.08, -1.3, 0] as [number, number, number],
    mobileScale: 1.48,
    entranceDurationMs: 1100,
    entranceOffsetY: 0.08,
    entranceStartScale: 0.96
  },
  lighting: {
    key: { intensity: 2.3, position: [-2.2, 2.8, 3] as [number, number, number], color: '#f1e8e5' },
    front: { intensity: 1.15, position: [-2.6, -0.1, 1.1] as [number, number, number], color: '#d9e1dc' },
    redRim: { intensity: 3.8, position: [2.8, 0.8, -1.8] as [number, number, number], color: '#8e2529' },
    greenFill: { intensity: 0.75, color: '#164d3d', groundColor: '#064e3b' },
    hemisphere: { intensity: 0.45, skyColor: '#d9dfda', groundColor: '#064e3b' }
  },
  interaction: { bodyYawRadians: 0.087, bodyPitchRadians: 0.025, headYawRadians: 0.14, headPitchRadians: 0.08, pointerDamping: 1.8, headDamping: 2.1 },
  quality: { desktopDpr: [1, 1.25] as [number, number], mobileDpr: [1, 1.05] as [number, number], mobileLightScale: 0.78 }
} as const;
