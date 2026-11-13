// Only the Three.js classes this site uses are bundled (no audio classes are included).
import { ACESFilmicToneMapping, AdditiveBlending, AnimationMixer, Box3, BoxGeometry, BufferAttribute, BufferGeometry, Float32BufferAttribute, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry, Euler, ExtrudeGeometry, FogExp2, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, LatheGeometry, Line, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, PCFShadowMap, PCFSoftShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry, PointLight, Points, PointsMaterial, QuadraticBezierCurve3, Quaternion, Raycaster, RepeatWrapping, RingGeometry, SRGBColorSpace, Scene, Shape, ShapeGeometry, SphereGeometry, Timer, TorusGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
window.THREE = { ACESFilmicToneMapping, AdditiveBlending, AnimationMixer, Box3, BoxGeometry, BufferAttribute, BufferGeometry, Float32BufferAttribute, CanvasTexture, CapsuleGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry, Euler, ExtrudeGeometry, FogExp2, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, LatheGeometry, Line, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, PCFShadowMap, PCFSoftShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry, PointLight, Points, PointsMaterial, QuadraticBezierCurve3, Quaternion, Raycaster, RepeatWrapping, RingGeometry, SRGBColorSpace, Scene, Shape, ShapeGeometry, SphereGeometry, Timer, TorusGeometry, Vector2, Vector3, WebGLRenderer };
window.THREE_ADDONS = { OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment, RoundedBoxGeometry, mergeGeometries, GLTFLoader, cloneSkinned, GTAOPass };
