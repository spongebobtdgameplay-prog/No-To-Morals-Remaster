import * as THREE from "three";
import {GameConfig} from "./config.js?v=20260830-v015";

function NormalizeAngle(Value){
  return Math.atan2(Math.sin(Value),Math.cos(Value));
}

function NormalizeWheelDelta(Event){
  let Delta = Event.deltaY;
  if(Event.deltaMode === WheelEvent.DOM_DELTA_LINE) Delta *= 16;
  else if(Event.deltaMode === WheelEvent.DOM_DELTA_PAGE) Delta *= Math.max(innerHeight,600);
  return THREE.MathUtils.clamp(Delta,-120,120);
}

export class InfinityCameraController{
  constructor(Camera,Canvas,Collision){
    this.Camera = Camera;
    this.Canvas = Canvas;
    this.Collision = Collision;
    this.Active = false;
    this.Distance = GameConfig.CameraDefault;
    this.OrbitHeld = false;
    this.OrbitReady = false;
    this.OrbitTargetYaw = 0;
    this.OrbitTargetPitch = 0;
    this.OrbitCurrentYaw = 0;
    this.OrbitCurrentPitch = 0;
    this.OrbitEuler = new THREE.Euler(0,0,0,"YXZ");
    this.SavedPosition = new THREE.Vector3();
    this.SavedQuaternion = new THREE.Quaternion();
    this.Forward = new THREE.Vector3();
    this.Right = new THREE.Vector3();
    this.Target = new THREE.Vector3();
    this.Desired = new THREE.Vector3();
    this.Safe = new THREE.Vector3();

    this.OnMouseDown = Event=>{
      if(!this.Active || Event.button !== 2) return;
      this.OrbitHeld = true;
      this.ReadOrbit();
      Event.preventDefault();
    };

    this.OnMouseUp = Event=>{
      if(Event.button !== 2) return;
      this.OrbitHeld = false;
      this.OrbitReady = false;
    };

    this.OnMouseMove = Event=>{
      if(!this.Active || !this.OrbitHeld) return;
      if(!this.OrbitReady && !this.ReadOrbit()) return;

      const Scale = 0.00185*GameConfig.CameraSensitivity;
      this.OrbitTargetYaw -= Event.movementX*Scale;
      this.OrbitTargetPitch -= Event.movementY*Scale;
      this.OrbitTargetPitch = THREE.MathUtils.clamp(this.OrbitTargetPitch,-1.12,1.08);
      Event.preventDefault();
    };

    this.OnWheel = Event=>{
      if(!this.Active) return;
      Event.preventDefault();
      const Delta = NormalizeWheelDelta(Event);
      if(Math.abs(Delta) < 0.01) return;
      this.Distance = THREE.MathUtils.clamp(
        this.Distance+Delta*GameConfig.CameraZoomScale,
        GameConfig.CameraMin,
        GameConfig.CameraMax
      );
    };

    this.OnContextMenu = Event=>{
      if(this.Active) Event.preventDefault();
    };

    addEventListener("mousedown",this.OnMouseDown);
    addEventListener("mouseup",this.OnMouseUp);
    document.addEventListener("mousemove",this.OnMouseMove,{passive:false});
    addEventListener("wheel",this.OnWheel,{passive:false});
    this.Canvas.addEventListener("contextmenu",this.OnContextMenu);
    addEventListener("blur",()=>{
      this.OrbitHeld = false;
      this.OrbitReady = false;
    });
  }

  SetActive(Value){
    this.Active = Boolean(Value);
    if(!this.Active){
      this.OrbitHeld = false;
      this.OrbitReady = false;
    }
  }

  ReadOrbit(){
    this.OrbitEuler.setFromQuaternion(this.Camera.quaternion,"YXZ");
    this.OrbitCurrentPitch = this.OrbitEuler.x;
    this.OrbitCurrentYaw = this.OrbitEuler.y;
    this.OrbitTargetPitch = this.OrbitCurrentPitch;
    this.OrbitTargetYaw = this.OrbitCurrentYaw;
    this.OrbitReady = true;
    return true;
  }

  Update(Delta){
    if(!this.Active || !this.OrbitHeld) return;
    if(!this.OrbitReady && !this.ReadOrbit()) return;

    const Smooth = THREE.MathUtils.clamp(GameConfig.CameraOrbitSmoothing,0,100)/100;
    const Responsiveness = THREE.MathUtils.lerp(30,10.5,Smooth);
    const Alpha = 1-Math.exp(-Math.max(0.001,Delta)*Responsiveness);

    this.OrbitCurrentYaw += NormalizeAngle(this.OrbitTargetYaw-this.OrbitCurrentYaw)*Alpha;
    this.OrbitCurrentPitch = THREE.MathUtils.lerp(
      this.OrbitCurrentPitch,
      this.OrbitTargetPitch,
      Alpha
    );

    this.OrbitEuler.set(
      this.OrbitCurrentPitch,
      this.OrbitCurrentYaw,
      0,
      "YXZ"
    );
    this.Camera.quaternion.setFromEuler(this.OrbitEuler);
    this.Camera.updateMatrixWorld(true);
  }

  SyncLogicalPosition(FeetPosition){
    this.Camera.position.set(
      FeetPosition.x,
      FeetPosition.y+GameConfig.PlayerEyeHeight,
      FeetPosition.z
    );
    this.Camera.updateMatrixWorld(true);
  }

  Render(Renderer,Scene,FeetPosition){
    this.SyncLogicalPosition(FeetPosition);
    this.SavedPosition.copy(this.Camera.position);
    this.SavedQuaternion.copy(this.Camera.quaternion);

    this.Forward.set(0,0,-1).applyQuaternion(this.SavedQuaternion);
    this.Forward.y = THREE.MathUtils.clamp(this.Forward.y,-0.72,0.72);
    if(this.Forward.lengthSq() < 0.0001) this.Forward.set(0,0,-1);
    this.Forward.normalize();

    this.Right.set(1,0,0).applyQuaternion(this.SavedQuaternion);
    this.Right.y = 0;
    if(this.Right.lengthSq() < 0.0001) this.Right.set(1,0,0);
    this.Right.normalize();

    this.Target.set(
      this.SavedPosition.x,
      FeetPosition.y+GameConfig.CameraTargetHeight,
      this.SavedPosition.z
    );

    this.Desired.copy(this.Target)
      .addScaledVector(this.Forward,-this.Distance)
      .addScaledVector(this.Right,GameConfig.CameraShoulder);

    this.Desired.y = THREE.MathUtils.clamp(
      this.Desired.y,
      FeetPosition.y+GameConfig.CameraFloor,
      FeetPosition.y+GameConfig.CameraCeiling
    );

    this.Safe.copy(
      this.Collision.ClipSegment(
        this.Target,
        this.Desired,
        GameConfig.CameraCollisionPadding
      )
    );

    this.Camera.position.copy(this.Safe);
    this.Camera.lookAt(this.Target);
    this.Camera.updateMatrixWorld(true);
    Renderer.render(Scene,this.Camera);

    this.Camera.position.copy(this.SavedPosition);
    this.Camera.quaternion.copy(this.SavedQuaternion);
    this.Camera.updateMatrixWorld(true);
  }
}
