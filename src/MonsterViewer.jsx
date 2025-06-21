import React, { useEffect, useRef, Suspense, useState, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations, Environment, Html } from '@react-three/drei';
import * as THREE from 'three';

// Error boundary for GLTF loading
class GLTFErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GLTF Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div style={{ 
            color: 'white', 
            textAlign: 'center', 
            background: 'rgba(255,0,0,0.8)',
            padding: '20px',
            borderRadius: '10px',
            maxWidth: '400px'
          }}>
            <div style={{ fontSize: '18px', marginBottom: '10px' }}>❌ 3D Model Loading Failed</div>
            <div style={{ fontSize: '12px', marginBottom: '15px' }}>
              Could not load the 3D model files. Please check:
            </div>
            <div style={{ fontSize: '11px', textAlign: 'left', marginBottom: '15px' }}>
              <div>• Files are in <code>public/models/</code> folder</div>
              <div>• File names match exactly:</div>
              <div style={{ marginLeft: '20px' }}>
                <div>- Monster.gltf</div>
                <div>- monstergltfAnimation.gltf</div>
                <div>- Monster.bin</div>
              </div>
            </div>
            <button
              style={{
                padding: '8px 16px',
                background: '#4ecdc4',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
              onClick={() => window.location.reload()}
            >
              Retry Loading
            </button>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

// Fixed loading timer hook
function useLoadingTimer() {
  const [loadTime, setLoadTime] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const startTimeRef = useRef(null);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsLoading(true);
    setLoadTime(null);
    console.log('Loading timer started');
  }, []);

  const stopTimer = useCallback(() => {
    if (startTimeRef.current) {
      const endTime = Date.now();
      const duration = endTime - startTimeRef.current;
      setLoadTime(duration);
      setIsLoading(false);
      console.log('Loading timer stopped:', duration + 'ms');
    }
  }, []);

  const reset = useCallback(() => {
    startTimeRef.current = null;
    setIsLoading(false);
    setLoadTime(null);
    console.log('Loading timer reset');
  }, []);

  return { startTimer, stopTimer, reset, loadTime, isLoading };
}

// Fixed Monster component with proper loading callbacks
function Monster({ 
  modelPath, 
  position = [0, 0, 0], 
  onModelLoaded, 
  onLoadingStart,
  onLoadingComplete,
  enableAnimation = true,
  label = "Model"
}) {
  const group = useRef();
  const [modelScale, setModelScale] = useState(1);
  const [modelCenter, setModelCenter] = useState([0, 0, 0]);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [hasCompletedLoading, setHasCompletedLoading] = useState(false);

  // Call loading start callback when component mounts
  useEffect(() => {
    if (!hasStartedLoading && onLoadingStart) {
      console.log('Starting to load model:', modelPath);
      onLoadingStart();
      setHasStartedLoading(true);
    }
  }, [modelPath, onLoadingStart, hasStartedLoading]);

  const { scene, animations } = useGLTF(modelPath);
  const { actions, mixer } = useAnimations(animations, group);

  // Handle model loading completion
  useEffect(() => {
    if (scene && hasStartedLoading && !hasCompletedLoading) {
      console.log('Model loaded successfully:', modelPath);
      
      // Auto-scale and center the model
      const box = new THREE.Box3().setFromObject(scene);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      const maxDimension = Math.max(size.x, size.y, size.z);
      const targetSize = 3;
      const scale = maxDimension > 0 ? targetSize / maxDimension : 1;
      
      setModelScale(scale);
      setModelCenter([-center.x * scale, -center.y * scale, -center.z * scale]);
      
      // Call completion callbacks
      if (onModelLoaded) {
        onModelLoaded({ size, center, scale, maxDimension });
      }
      
      if (onLoadingComplete) {
        onLoadingComplete();
      }
      
      setHasCompletedLoading(true);
    }
  }, [scene, hasStartedLoading, hasCompletedLoading, modelPath, onModelLoaded, onLoadingComplete]);

  // Handle animations
  useEffect(() => {
    if (enableAnimation && actions && Object.keys(actions).length > 0) {
      const actionNames = Object.keys(actions);
      const firstActionName = actionNames[0];
      const firstAction = actions[firstActionName];
      
      firstAction.reset();
      firstAction.setLoop(THREE.LoopRepeat, Infinity);
      firstAction.fadeIn(0.5);
      firstAction.play();
    }

    return () => {
      if (mixer) {
        mixer.stopAllAction();
      }
    };
  }, [actions, mixer, enableAnimation]);

  return (
    <group ref={group} position={position}>
      <primitive 
        object={scene} 
        scale={[modelScale, modelScale, modelScale]} 
        position={modelCenter}
      />
      
      {/* Model label */}
      <Html position={[0, 3, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 'bold',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// Fixed loading component
function LoadingIndicator({ label, loadTime, isLoading }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (isLoading) {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [isLoading]);

  if (!isLoading && !loadTime) return null;

  return (
    <Html center>
      <div style={{ 
        color: 'white', 
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        background: 'rgba(0,0,0,0.9)',
        padding: '15px',
        borderRadius: '8px',
        minWidth: '150px',
        border: '2px solid #4ecdc4'
      }}>
        {isLoading ? (
          <>
            <div>Loading {label}{dots}</div>
            <div style={{ 
              marginTop: '10px',
              width: '100px',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
              overflow: 'hidden',
              margin: '10px auto 0'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #ff6b6b, #4ecdc4)',
                animation: 'loading 2s infinite'
              }} />
            </div>
          </>
        ) : loadTime ? (
          <div style={{ color: '#4ecdc4' }}>
            {label} loaded in {loadTime}ms
          </div>
        ) : null}
        
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </Html>
  );
}

// Fixed performance comparison component
function PerformanceComparison({ staticTime, animationTime, onReset }) {
  if (!staticTime || !animationTime) return null;

  const faster = staticTime < animationTime ? 'static' : 'animation';
  const slower = staticTime < animationTime ? 'animation' : 'static';
  const difference = Math.abs(staticTime - animationTime);
  const percentDiff = ((difference / Math.max(staticTime, animationTime)) * 100).toFixed(1);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.95)',
      color: 'white',
      padding: '20px',
      borderRadius: '12px',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      backdropFilter: 'blur(10px)',
      border: '2px solid #4ecdc4',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    }}>
      <div style={{ fontSize: '16px', marginBottom: '15px', color: '#4ecdc4' }}>
        📊 Loading Performance Comparison
      </div>
      
      <div style={{ display: 'flex', gap: '30px', marginBottom: '15px', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>Static Model</div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: faster === 'static' ? '#4ecdc4' : '#ff6b6b',
            padding: '5px 10px',
            border: `2px solid ${faster === 'static' ? '#4ecdc4' : '#ff6b6b'}`,
            borderRadius: '8px',
            background: faster === 'static' ? 'rgba(78, 205, 196, 0.1)' : 'rgba(255, 107, 107, 0.1)'
          }}>
            {staticTime}ms
          </div>
          {faster === 'static' && <div style={{ fontSize: '12px', color: '#4ecdc4', marginTop: '5px' }}>🏆 Winner</div>}
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', color: '#ccc', marginBottom: '5px' }}>Animation Model</div>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: faster === 'animation' ? '#4ecdc4' : '#ff6b6b',
            padding: '5px 10px',
            border: `2px solid ${faster === 'animation' ? '#4ecdc4' : '#ff6b6b'}`,
            borderRadius: '8px',
            background: faster === 'animation' ? 'rgba(78, 205, 196, 0.1)' : 'rgba(255, 107, 107, 0.1)'
          }}>
            {animationTime}ms
          </div>
          {faster === 'animation' && <div style={{ fontSize: '12px', color: '#4ecdc4', marginTop: '5px' }}>🏆 Winner</div>}
        </div>
      </div>
      
      <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
        <div style={{ fontSize: '12px', color: '#4ecdc4', marginBottom: '5px' }}>
          ⚡ Performance Difference
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {faster === 'static' ? 'Static' : 'Animation'} model was {difference}ms faster
        </div>
        <div style={{ fontSize: '11px', color: '#ccc' }}>
          ({percentDiff}% performance difference)
        </div>
      </div>
      
      <button
        onClick={onReset}
        style={{
          padding: '10px 20px',
          background: '#4ecdc4',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => e.target.style.background = '#3ba99c'}
        onMouseOut={(e) => e.target.style.background = '#4ecdc4'}
      >
        🔄 Test Again
      </button>
    </div>
  );
}

// Main viewer component
export default function MonsterCompareViewer() {
  const [viewMode, setViewMode] = useState('single');
  const [singleModelType, setSingleModelType] = useState('animation');
  
  // Fixed loading timers
  const staticTimer = useLoadingTimer();
  const animationTimer = useLoadingTimer();
  
  const [modelInfo, setModelInfo] = useState({});

  const handleModelLoaded = useCallback((info, type) => {
    setModelInfo(prev => ({ ...prev, [type]: info }));
  }, []);

  const handleCompareReset = useCallback(() => {
    console.log('Resetting comparison');
    staticTimer.reset();
    animationTimer.reset();
    setModelInfo({});
  }, [staticTimer, animationTimer]);

  const handleViewModeChange = useCallback((mode) => {
    console.log('Changing view mode to:', mode);
    setViewMode(mode);
    // Reset timers when switching modes
    staticTimer.reset();
    animationTimer.reset();
    setModelInfo({});
  }, [staticTimer, animationTimer]);

  const singleModelPath = singleModelType === 'animation' 
    ? '/models/monstergltfAnimation.gltf' 
    : '/models/Monster.gltf';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#1a1a1a' }}>
      {/* Mode selector */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        gap: '10px',
        background: 'rgba(0,0,0,0.9)',
        padding: '10px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid #4ecdc4'
      }}>
        <button
          onClick={() => handleViewModeChange('single')}
          style={{
            padding: '8px 16px',
            background: viewMode === 'single' ? '#4ecdc4' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          👁️ Single View
        </button>
        <button
          onClick={() => handleViewModeChange('compare')}
          style={{
            padding: '8px 16px',
            background: viewMode === 'compare' ? '#4ecdc4' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          ⚖️ Compare Mode
        </button>
        
        {viewMode === 'single' && (
          <>
            <div style={{ width: '1px', background: '#666', margin: '0 5px' }} />
            <button
              onClick={() => setSingleModelType('animation')}
              style={{
                padding: '8px 16px',
                background: singleModelType === 'animation' ? '#4ecdc4' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              🎬 Animation
            </button>
            <button
              onClick={() => setSingleModelType('static')}
              style={{
                padding: '8px 16px',
                background: singleModelType === 'static' ? '#4ecdc4' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              🗿 Static
            </button>
          </>
        )}
      </div>

      <Canvas 
        camera={{ 
          position: viewMode === 'compare' ? [0, 3, 10] : [5, 3, 8], 
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
      >
        {/* Lighting setup */}
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[5, 5, 5]} 
          intensity={1.2}
          castShadow
        />
        <pointLight position={[-5, 5, 5]} intensity={0.4} />
        <spotLight position={[0, 10, 0]} intensity={0.3} />

        <Environment preset="sunset" />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial 
            color="#2a2a2a" 
            opacity={0.8} 
            transparent 
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>

        <gridHelper args={[20, 20, '#444', '#222']} position={[0, -2, 0]} />

        {/* Render based on view mode */}
        {viewMode === 'single' ? (
          <GLTFErrorBoundary key={`single-${singleModelPath}`}>
            <Suspense fallback={<LoadingIndicator label="Model" isLoading={true} />}>
              <Monster 
                modelPath={singleModelPath}
                onModelLoaded={(info) => handleModelLoaded(info, singleModelType)}
                enableAnimation={singleModelType === 'animation'}
                label={singleModelType === 'animation' ? '🎬 Animation Model' : '🗿 Static Model'}
              />
            </Suspense>
          </GLTFErrorBoundary>
        ) : (
          <>
            {/* Static model on the left */}
            <GLTFErrorBoundary key="static-compare">
              <Suspense fallback={
                <LoadingIndicator 
                  label="Static" 
                  loadTime={staticTimer.loadTime}
                  isLoading={staticTimer.isLoading}
                />
              }>
                <Monster 
                  modelPath="/models/Monster.gltf"
                  position={[-4, 0, 0]}
                  onModelLoaded={(info) => handleModelLoaded(info, 'static')}
                  onLoadingStart={staticTimer.startTimer}
                  onLoadingComplete={staticTimer.stopTimer}
                  enableAnimation={false}
                  label="🗿 Static Model"
                />
              </Suspense>
            </GLTFErrorBoundary>

            {/* Animation model on the right */}
            <GLTFErrorBoundary key="animation-compare">
              <Suspense fallback={
                <LoadingIndicator 
                  label="Animation" 
                  loadTime={animationTimer.loadTime}
                  isLoading={animationTimer.isLoading}
                />
              }>
                <Monster 
                  modelPath="/models/monstergltfAnimation.gltf"
                  position={[4, 0, 0]}
                  onModelLoaded={(info) => handleModelLoaded(info, 'animation')}
                  onLoadingStart={animationTimer.startTimer}
                  onLoadingComplete={animationTimer.stopTimer}
                  enableAnimation={true}
                  label="🎬 Animation Model"
                />
              </Suspense>
            </GLTFErrorBoundary>
          </>
        )}

        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={50}
          maxPolarAngle={Math.PI - 0.1}
          minPolarAngle={0.1}
          enableDamping={true}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Performance comparison overlay */}
      {viewMode === 'compare' && (
        <PerformanceComparison
          staticTime={staticTimer.loadTime}
          animationTime={animationTimer.loadTime}
          onReset={handleCompareReset}
        />
      )}

      {/* Debug info overlay */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: '20px',
        background: 'rgba(0,0,0,0.95)',
        color: 'white',
        padding: '15px',
        borderRadius: '10px',
        fontSize: '11px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        backdropFilter: 'blur(10px)',
        border: '1px solid #4ecdc4'
      }}>
        <div style={{ fontSize: '14px', marginBottom: '10px', color: '#4ecdc4' }}>
          🎮 Monster 3D Viewer
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', marginBottom: '5px', color: '#4ecdc4' }}>
            📊 Current Mode: {viewMode === 'single' ? 'Single View' : 'Compare Mode'}
          </div>
          {viewMode === 'single' && (
            <div style={{ fontSize: '10px', color: '#ccc' }}>
              Showing: {singleModelType === 'animation' ? 'Animation' : 'Static'} model
            </div>
          )}
        </div>
        
        {viewMode === 'compare' && (
          <div style={{ marginBottom: '10px', fontSize: '10px' }}>
            <div style={{ color: '#4ecdc4', marginBottom: '5px' }}>⏱️ Loading Status:</div>
            <div style={{ marginLeft: '10px' }}>
              <div style={{ marginBottom: '2px' }}>
                Static: {staticTimer.isLoading ? '🔄 Loading...' : staticTimer.loadTime ? `✅ ${staticTimer.loadTime}ms` : '⏳ Pending'}
              </div>
              <div>
                Animation: {animationTimer.isLoading ? '🔄 Loading...' : animationTimer.loadTime ? `✅ ${animationTimer.loadTime}ms` : '⏳ Pending'}
              </div>
            </div>
          </div>
        )}
        
        <div style={{ fontSize: '10px', lineHeight: '1.4', color: '#ccc' }}>
          <div>🖱️ Controls:</div>
          <div>• Left Click + Drag: Rotate</div>
          <div>• Right Click + Drag: Pan</div>
          <div>• Mouse Wheel: Zoom</div>
        </div>
      </div>
    </div>
  );
}