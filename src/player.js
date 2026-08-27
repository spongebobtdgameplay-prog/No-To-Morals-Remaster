import * as THREE from "three";
import {GameConfig} from "./config.js";
import {LimbContactSystem} from "./animation-contact.js";

function ExpAlpha(Delta,Rate){
  return 1-Math.exp(-Rate*Delta);
}

function NormalizeAngle(Value){
  while(Value > Math.PI) Value -= Math.PI*2;
  while(Value < -Math.PI) Value += Math.PI*2;
  return Value;
}

export class PlayerController{
  constructor(Camera,Canvas,Collision){
    this.Camera = Camera;
    this.Canvas = Canvas;
    this.Collision = Collision;
    this.Position = new THREE.Vector3(0,0,16);
    this.Keys = new Set();
    this.Yaw = Math.PI;
    this.Pitch = -0.16;
    this.CameraDistance = GameConfig.CameraDefault;
    this.VerticalVelocity = 0;
    this.Grounded = true;
    this.Stamina = 100;
    this.LastSprintTime = -99;
    this.CharacterRoot = new THREE.Group();
    this.Character = null;
    this.Animator = null;
    this.LimbContact = null;
    this.InteractQueued = false;
    this.FireQueued = false;
    this.Active = false;
    this.LastFacing = Math.PI;
    this.LastSpeed = 0;

    this.OnKeyDown = Event=>{
      if(["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight"].includes(Event.code)){
        this.Keys.add(Event.code);
      }
      if(Event.code === "Space" && !Event.repeat && this.Active){
        if(this.Grounded){
          this.VerticalVelocity = GameConfig.JumpSpeed;
          this.Grounded = false;
        }
      }
      if(Event.code === "KeyE" && !Event.repeat && this.Active) this.InteractQueued = true;
    };

    this.OnKeyUp = Event=>this.Keys.delete(Event.code);

    this.OnMouseMove = Event=>{
      if(!this.Active || document.pointerLockElement !== this.Canvas) return;
      this.Yaw -= Event.movementX*0.0021;
      this.Pitch -= Event.movementY*0.0017;
      this.Pitch = THREE.MathUtils.clamp(this.Pitch,-0.82,0.48);
    };

    this.OnMouseDown = Event=>{
      if(!this.Active) return;
      if(document.pointerLockElement !== this.Canvas){
        this.Canvas.requestPointerLock?.();
        return;
      }
      if(Event.button === 0) this.FireQueued = true;
    };

    this.OnWheel = Event=>{
      if(!this.Active) return;
      this.CameraDistance = THREE.MathUtils.clamp(
        this.CameraDistance+Math.sign(Event.deltaY)*0.35,
        GameConfig.CameraMin,
        GameConfig.CameraMax
      );
    };

    addEventListener("keydown",this.OnKeyDown);
    addEventListener("keyup",this.OnKeyUp);
    addEventListener("mousemove",this.OnMouseMove);
    addEventListener("mousedown",this.OnMouseDown);
    addEventListener("wheel",this.OnWheel,{passive:true});
    addEventListener("blur",()=>this.Keys.clear());
  }

  AttachCharacter(CharacterData,Scene){
    this.Character = CharacterData.Model;
    this.Animator = CharacterData.Animator;
    this.LimbContact = new LimbContactSystem(this.Character,this.Collision);
    this.CharacterRoot.add(this.Character);
    Scene.add(this.CharacterRoot);
    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing;
  }

  SetActive(Value){
    this.Active = Boolean(Value);
    if(!this.Active) this.Keys.clear();
  }

  ConsumeInteract(){
    const Value = this.InteractQueued;
    this.InteractQueued = false;
    return Value;
  }

  ConsumeFire(){
    const Value = this.FireQueued;
    this.FireQueued = false;
    return Value;
  }

  GetAimRay(){
    const Origin = this.Camera.position.clone();
    const Direction = new THREE.Vector3(0,0,-1).applyQuaternion(this.Camera.quaternion).normalize();
    return {Origin,Direction};
  }

  Update(Delta){
    if(!this.Active) return;

    let ForwardInput = 0;
    let RightInput = 0;
    if(this.Keys.has("KeyW")) ForwardInput += 1;
    if(this.Keys.has("KeyS")) ForwardInput -= 1;
    if(this.Keys.has("KeyD")) RightInput += 1;
    if(this.Keys.has("KeyA")) RightInput -= 1;

    const InputLength = Math.hypot(ForwardInput,RightInput);
    if(InputLength > 1){
      ForwardInput /= InputLength;
      RightInput /= InputLength;
    }

    const Forward = new THREE.Vector3(Math.sin(this.Yaw),0,Math.cos(this.Yaw));
    const Right = new THREE.Vector3(Math.cos(this.Yaw),0,-Math.sin(this.Yaw));
    const MoveDirection = new THREE.Vector3()
      .addScaledVector(Forward,ForwardInput)
      .addScaledVector(Right,RightInput);

    const Moving = MoveDirection.lengthSq() > 0.0001;
    if(Moving) MoveDirection.normalize();

    const WantsSprint = (this.Keys.has("ShiftLeft") || this.Keys.has("ShiftRight")) && Moving;
    let Sprinting = WantsSprint && this.Stamina > 0.5;

    if(Sprinting){
      this.Stamina = Math.max(0,this.Stamina-GameConfig.StaminaDrain*Delta);
      this.LastSprintTime = performance.now()/1000;
      if(this.Stamina <= 0.5) Sprinting = false;
    }else if(performance.now()/1000-this.LastSprintTime > GameConfig.StaminaRegenDelay){
      this.Stamina = Math.min(100,this.Stamina+GameConfig.StaminaRegen*Delta);
    }

    const Speed = Moving ? (Sprinting ? GameConfig.SprintSpeed : GameConfig.WalkSpeed) : 0;
    this.LastSpeed = THREE.MathUtils.lerp(this.LastSpeed,Speed,ExpAlpha(Delta,9));

    const HorizontalDelta = MoveDirection.clone().multiplyScalar(Speed*Delta);
    const Result = this.Collision.ResolveMove(this.Position,HorizontalDelta,GameConfig.PlayerRadius);
    this.Position.x = Result.Position.x;
    this.Position.z = Result.Position.z;

    this.VerticalVelocity -= GameConfig.Gravity*Delta;
    this.Position.y += this.VerticalVelocity*Delta;
    if(this.Position.y <= 0){
      this.Position.y = 0;
      this.VerticalVelocity = 0;
      this.Grounded = true;
    }

    let TurnRate = 0;
    if(Moving){
      const TargetFacing = Math.atan2(MoveDirection.x,MoveDirection.z);
      const Difference = NormalizeAngle(TargetFacing-this.LastFacing);
      TurnRate = Difference/Math.max(Delta,0.001);
      this.LastFacing += Difference*ExpAlpha(Delta,14);
    }

    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing;
    this.LimbContact?.Restore();
    this.Animator?.Update(Delta,this.LastSpeed,THREE.MathUtils.clamp(TurnRate,-4,4));
    this.LimbContact?.Apply();

    const Target = new THREE.Vector3(
      this.Position.x,
      this.Position.y+GameConfig.CameraHeight,
      this.Position.z
    );
    const ViewForward = new THREE.Vector3(
      Math.sin(this.Yaw)*Math.cos(this.Pitch),
      Math.sin(this.Pitch),
      Math.cos(this.Yaw)*Math.cos(this.Pitch)
    ).normalize();
    const ViewRight = new THREE.Vector3(Math.cos(this.Yaw),0,-Math.sin(this.Yaw));
    const DesiredCamera = Target.clone()
      .addScaledVector(ViewForward,-this.CameraDistance)
      .addScaledVector(ViewRight,GameConfig.CameraShoulder);
    const SafeCamera = this.Collision.ClipSegment(Target,DesiredCamera,0.14);

    this.Camera.position.lerp(SafeCamera,ExpAlpha(Delta,18));
    this.Camera.lookAt(Target.clone().addScaledVector(ViewForward,2));
  }
}
