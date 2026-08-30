import * as THREE from "three";
import {GameConfig} from "./config.js?v=20260830-v012b";
import {LimbContactSystem} from "./animation-contact.js?v=20260830-v012";

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
    this.Position = new THREE.Vector3(0,0,6);
    this.Keys = new Set();
    this.TargetYaw = Math.PI;
    this.Yaw = this.TargetYaw;
    this.TargetPitch = -0.16;
    this.Pitch = this.TargetPitch;
    this.TargetCameraDistance = GameConfig.CameraDefault;
    this.CameraDistance = this.TargetCameraDistance;
    this.VerticalVelocity = 0;
    this.Grounded = true;
    this.Stamina = 100;
    this.LastSprintTime = -99;
    this.CharacterRoot = new THREE.Group();
    this.Character = null;
    this.Animator = null;
    this.LimbContact = null;
    this.RightHand = null;
    this.BagAnchor = null;
    this.ModelFacingOffset = 0;
    this.ToolVisual = null;
    this.ToolKick = 0;
    this.ToolWorldPosition = new THREE.Vector3();
    this.ToolLocalPosition = new THREE.Vector3();
    this.MoveForward = new THREE.Vector3();
    this.MoveRight = new THREE.Vector3();
    this.MoveDirection = new THREE.Vector3();
    this.UpVector = new THREE.Vector3(0,1,0);
    this.InteractQueued = false;
    this.FireQueued = false;
    this.Active = false;
    this.LastFacing = Math.PI;
    this.LastSpeed = 0;
    this.CameraTarget = new THREE.Vector3(0,GameConfig.CameraHeight,6);
    this.CameraPosition = new THREE.Vector3(0,2.2,8);
    this.CameraBoomDistance = GameConfig.CameraDefault;
    this.CameraLookTarget = new THREE.Vector3();
    this.CameraInitialized = false;
    this.LootBag = null;
    this.LootBagBaseScale = new THREE.Vector3(1,1,1);
    this.LootBagBasePosition = new THREE.Vector3();
    this.LootBagAnchorWorld = new THREE.Vector3();
    this.LootBagFullness = 0;

    this.OnKeyDown = Event=>{
      if(["KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight"].includes(Event.code)){
        this.Keys.add(Event.code);
      }

      if(Event.code === "Space" && !Event.repeat && this.Active && this.Grounded){
        this.VerticalVelocity = GameConfig.JumpSpeed;
        this.Grounded = false;
      }

      if(Event.code === "KeyE" && !Event.repeat && this.Active) this.InteractQueued = true;
    };

    this.OnKeyUp = Event=>this.Keys.delete(Event.code);

    this.OnMouseMove = Event=>{
      if(!this.Active || document.pointerLockElement !== this.Canvas) return;
      this.TargetYaw = NormalizeAngle(this.TargetYaw-Event.movementX*0.0021);
      this.TargetPitch -= Event.movementY*0.0017;
      this.TargetPitch = THREE.MathUtils.clamp(this.TargetPitch,-0.82,0.48);
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
      this.TargetCameraDistance = THREE.MathUtils.clamp(
        this.TargetCameraDistance+Math.sign(Event.deltaY)*0.35,
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
    this.RightHand = CharacterData.RightHand || null;
    this.BagAnchor = CharacterData.BagAnchor || null;
    this.ModelFacingOffset = CharacterData.FacingOffset || 0;
    this.LimbContact = null;
    this.CharacterRoot.add(this.Character);
    Scene.add(this.CharacterRoot);
    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing+this.ModelFacingOffset;
  }

  AttachLootBag(Bag){
    this.LootBag = Bag;
    this.LootBagBaseScale.copy(Bag.scale);
    this.CharacterRoot.add(Bag);
    Bag.position.set(-0.46,0.92,0.06);
    Bag.rotation.set(0.08,Math.PI/2,-0.08);
    this.LootBagBasePosition.copy(Bag.position);
    this.UpdateLootBag(0);
    this.UpdateLootBagTransform();
  }

  UpdateLootBag(Progress){
    if(!this.LootBag) return;
    const Fullness = THREE.MathUtils.clamp(Progress,0,1);
    this.LootBagFullness = Fullness;
    this.LootBag.scale.set(
      this.LootBagBaseScale.x*(0.94+Fullness*0.06),
      this.LootBagBaseScale.y*(0.72+Fullness*0.28),
      this.LootBagBaseScale.z*(0.8+Fullness*0.2)
    );
  }

  UpdateLootBagTransform(){
    if(!this.LootBag) return;
    if(this.BagAnchor){
      this.CharacterRoot.updateMatrixWorld(true);
      this.BagAnchor.getWorldPosition(this.LootBagAnchorWorld);
      this.CharacterRoot.worldToLocal(this.LootBagAnchorWorld);
      this.LootBag.position.copy(this.LootBagAnchorWorld);
      this.LootBag.position.x -= 0.46;
      this.LootBag.position.y -= 0.37-this.LootBagFullness*0.018;
      this.LootBag.position.z += 0.06;
    }else{
      this.LootBag.position.copy(this.LootBagBasePosition);
      this.LootBag.position.y += this.LootBagFullness*0.018;
    }
  }

  EquipBreachTool(Tool){
    if(this.ToolVisual?.parent) this.ToolVisual.parent.remove(this.ToolVisual);
    this.ToolVisual = Tool;
    this.ToolVisual.scale.setScalar(0.82);
    this.CharacterRoot.add(this.ToolVisual);
    this.UpdateToolVisual(0);
  }

  TriggerToolPulse(){
    this.ToolKick = 1;
  }

  UpdateToolVisual(Delta){
    if(!this.ToolVisual) return;

    this.ToolKick = Math.max(0,this.ToolKick-Delta*9.5);

    if(this.RightHand){
      this.CharacterRoot.updateMatrixWorld(true);
      this.RightHand.getWorldPosition(this.ToolWorldPosition);
      this.ToolLocalPosition.copy(this.ToolWorldPosition);
      this.CharacterRoot.worldToLocal(this.ToolLocalPosition);
      this.ToolVisual.position.copy(this.ToolLocalPosition);
      this.ToolVisual.position.y -= 0.04;
      this.ToolVisual.position.z += 0.14-this.ToolKick*0.055;
    }else{
      this.ToolVisual.position.set(0.27,1.05,0.14-this.ToolKick*0.055);
    }

    this.ToolVisual.rotation.set(-0.04,0,0.08);
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

    const YawDifference = NormalizeAngle(this.TargetYaw-this.Yaw);
    this.Yaw = NormalizeAngle(this.Yaw+YawDifference*ExpAlpha(Delta,GameConfig.CameraYawDamping));
    this.Pitch = THREE.MathUtils.lerp(this.Pitch,this.TargetPitch,ExpAlpha(Delta,GameConfig.CameraPitchDamping));
    this.CameraDistance = THREE.MathUtils.lerp(
      this.CameraDistance,
      this.TargetCameraDistance,
      ExpAlpha(Delta,GameConfig.CameraZoomDamping)
    );

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

    this.MoveForward.set(Math.sin(this.Yaw),0,Math.cos(this.Yaw));

    this.MoveRight.crossVectors(this.MoveForward,this.UpVector).normalize();

    this.MoveDirection.set(0,0,0)
      .addScaledVector(this.MoveForward,ForwardInput)
      .addScaledVector(this.MoveRight,RightInput);

    const Moving = this.MoveDirection.lengthSq() > 0.0001;
    if(Moving) this.MoveDirection.normalize();

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
    this.LastSpeed = Speed;

    const HorizontalDelta = this.MoveDirection.clone().multiplyScalar(Speed*Delta);
    const Result = this.Collision.ResolveMove(
      this.Position,
      HorizontalDelta,
      GameConfig.PlayerRadius,
      {
        MinY:this.Position.y+0.035,
        MaxY:this.Position.y+GameConfig.PlayerColliderHeight,
        MaxStepHeight:GameConfig.MaxStepHeight,
        Skin:GameConfig.CollisionSkin,
        AllowSlide:true
      }
    );

    this.Position.x = Result.Position.x;
    this.Position.z = Result.Position.z;

    if(Result.Stepped && Number.isFinite(Result.StepHeight) && this.VerticalVelocity <= 0.2){
      this.Position.y = Math.max(this.Position.y,Result.StepHeight);
      this.VerticalVelocity = 0;
      this.Grounded = true;
    }

    const PreviousFeetY = this.Position.y;
    this.VerticalVelocity -= GameConfig.Gravity*Delta;
    const NextFeetY = PreviousFeetY+this.VerticalVelocity*Delta;

    if(this.VerticalVelocity <= 0){
      const LandingHeight = this.Collision.FindLandingHeight(
        this.Position,
        GameConfig.PlayerRadius*0.72,
        PreviousFeetY,
        NextFeetY
      );

      if(Number.isFinite(LandingHeight)){
        this.Position.y = LandingHeight;
        this.VerticalVelocity = 0;
        this.Grounded = true;
      }else{
        this.Position.y = NextFeetY;
        this.Grounded = false;
      }
    }else{
      this.Position.y = NextFeetY;
      this.Grounded = false;
    }

    if(this.Position.y < 0){
      this.Position.y = 0;
      this.VerticalVelocity = 0;
      this.Grounded = true;
    }

    let TurnRate = 0;

    if(Moving){
      const TargetFacing = Math.atan2(this.MoveDirection.x,this.MoveDirection.z);
      const Difference = NormalizeAngle(TargetFacing-this.LastFacing);
      TurnRate = Difference/Math.max(Delta,0.001);
      this.LastFacing += Difference*ExpAlpha(Delta,22);
    }

    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing+this.ModelFacingOffset;
    this.LimbContact?.Restore();
    this.Animator?.Update(Delta,this.LastSpeed,THREE.MathUtils.clamp(TurnRate,-4,4));
    this.LimbContact?.Apply();
    this.UpdateLootBagTransform();
    this.UpdateToolVisual(Delta);

    const RawTarget = this.CameraLookTarget.set(
      this.Position.x,
      this.Position.y+GameConfig.CameraHeight,
      this.Position.z
    );

    if(!this.CameraInitialized){
      this.CameraTarget.copy(RawTarget);
      this.CameraInitialized = true;
    }else{
      this.CameraTarget.lerp(RawTarget,ExpAlpha(Delta,GameConfig.CameraTargetDamping));
    }

    const ViewForward = new THREE.Vector3(
      Math.sin(this.Yaw)*Math.cos(this.Pitch),
      Math.sin(this.Pitch),
      Math.cos(this.Yaw)*Math.cos(this.Pitch)
    ).normalize();

    const ViewRight = new THREE.Vector3(-Math.cos(this.Yaw),0,Math.sin(this.Yaw));

    const DesiredCamera = this.CameraTarget.clone()
      .addScaledVector(ViewForward,-this.CameraDistance)
      .addScaledVector(ViewRight,GameConfig.CameraShoulder);

    const SafeCamera = this.Collision.ClipSegment(this.CameraTarget,DesiredCamera,GameConfig.CameraCollisionPadding);
    const DesiredBoom = SafeCamera.distanceTo(this.CameraTarget);
    if(DesiredBoom < this.CameraBoomDistance){
      this.CameraBoomDistance = DesiredBoom;
    }else{
      this.CameraBoomDistance = THREE.MathUtils.lerp(
        this.CameraBoomDistance,
        DesiredBoom,
        ExpAlpha(Delta,GameConfig.CameraBoomDamping)
      );
    }
    const CameraDirection = DesiredCamera.sub(this.CameraTarget).normalize();
    const BoomCamera = this.CameraTarget.clone().addScaledVector(CameraDirection,this.CameraBoomDistance);
    const PositionTarget = this.Collision.ClipSegment(
      this.CameraTarget,
      BoomCamera,
      GameConfig.CameraCollisionPadding
    );
    this.CameraPosition.lerp(PositionTarget,ExpAlpha(Delta,GameConfig.CameraPositionDamping));
    this.CameraPosition.copy(this.Collision.ClipSegment(
      this.CameraTarget,
      this.CameraPosition,
      GameConfig.CameraCollisionPadding
    ));
    this.Camera.position.copy(this.CameraPosition);
    this.Camera.lookAt(this.CameraTarget.clone().addScaledVector(ViewForward,2));
  }
}
