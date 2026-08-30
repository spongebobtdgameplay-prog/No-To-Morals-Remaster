import * as THREE from "three";
import {GameConfig} from "./config.js?v=20260830-v015";
import {InfinityMovementController} from "./infinity-movement.js?v=20260830-v015";
import {InfinityCameraController} from "./infinity-camera.js?v=20260830-v015";

function ExpAlpha(Delta,Rate){
  return 1-Math.exp(-Rate*Delta);
}

function NormalizeAngle(Value){
  return Math.atan2(Math.sin(Value),Math.cos(Value));
}

export class PlayerController{
  constructor(Camera,Canvas,Collision){
    this.Camera = Camera;
    this.Canvas = Canvas;
    this.Collision = Collision;
    this.Movement = new InfinityMovementController(Camera,Collision);
    this.CameraRig = new InfinityCameraController(Camera,Canvas,Collision);
    this.Position = new THREE.Vector3(0,0,6);
    this.Keys = new Set();
    this.VerticalVelocity = 0;
    this.Grounded = true;
    this.Stamina = 100;
    this.LastSprintTime = -99;
    this.CharacterRoot = new THREE.Group();
    this.CharacterRoot.name = "PlayerCharacterPivot";
    this.CharacterRoot.userData.IgnoreRayCollision = true;
    this.Character = null;
    this.Animator = null;
    this.RightHand = null;
    this.BagAnchor = null;
    this.ModelFacingOffset = 0;
    this.ToolVisual = null;
    this.ToolKick = 0;
    this.ToolWorldPosition = new THREE.Vector3();
    this.ToolLocalPosition = new THREE.Vector3();
    this.MoveDirection = new THREE.Vector3();
    this.InteractQueued = false;
    this.FireQueued = false;
    this.Active = false;
    this.LastFacing = Math.PI;
    this.LastSpeed = 0;
    this.LootBag = null;
    this.LootBagBaseScale = new THREE.Vector3(1,1,1);
    this.LootBagBasePosition = new THREE.Vector3();
    this.LootBagBaseQuaternion = new THREE.Quaternion();
    this.LootBagAnchorWorld = new THREE.Vector3();
    this.LootBagAnchorQuaternion = new THREE.Quaternion();
    this.CharacterRootQuaternion = new THREE.Quaternion();
    this.LootBagFullness = 0;

    this.CameraRig.SyncLogicalPosition(this.Position);

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

    this.OnMouseDown = Event=>{
      if(!this.Active || Event.button !== 0) return;
      this.FireQueued = true;
    };

    addEventListener("keydown",this.OnKeyDown);
    addEventListener("keyup",this.OnKeyUp);
    addEventListener("mousedown",this.OnMouseDown);
    addEventListener("blur",()=>this.Keys.clear());
  }

  AttachCharacter(CharacterData,Scene){
    this.Character = CharacterData.Model;
    this.Animator = CharacterData.Animator;
    this.RightHand = CharacterData.RightHand || null;
    this.BagAnchor = CharacterData.BagAnchor || null;
    this.ModelFacingOffset = CharacterData.FacingOffset || 0;
    this.CharacterRoot.add(this.Character);
    Scene.add(this.CharacterRoot);
    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing+this.ModelFacingOffset;
  }

  AttachLootBag(Bag){
    this.LootBag = Bag;
    this.LootBagBaseScale.copy(Bag.scale);
    this.CharacterRoot.add(Bag);
    Bag.position.set(-0.28,0.82,-0.14);
    Bag.rotation.set(0.06,Math.PI/2,-0.2);
    this.LootBagBasePosition.copy(Bag.position);
    this.LootBagBaseQuaternion.copy(Bag.quaternion);
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
      this.LootBag.position.x -= 0.28;
      this.LootBag.position.y -= 0.10-this.LootBagFullness*0.012;
      this.LootBag.position.z -= 0.14;

      this.BagAnchor.getWorldQuaternion(this.LootBagAnchorQuaternion);
      this.CharacterRoot.getWorldQuaternion(this.CharacterRootQuaternion);
      this.CharacterRootQuaternion.invert();
      this.LootBag.quaternion
        .copy(this.CharacterRootQuaternion)
        .multiply(this.LootBagAnchorQuaternion)
        .multiply(this.LootBagBaseQuaternion);
    }else{
      this.LootBag.position.copy(this.LootBagBasePosition);
      this.LootBag.position.y += this.LootBagFullness*0.018;
      this.LootBag.quaternion.copy(this.LootBagBaseQuaternion);
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
    this.CameraRig.SetActive(this.Active);
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

    this.CameraRig.Update(Delta);

    const Input = this.Movement.ReadInput(this.Keys);
    const Moving = Input.Moving;
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
    const Result = this.Movement.Move(
      this.Position,
      Input.Forward,
      Input.Right,
      Speed*Delta,
      {
        Radius:GameConfig.PlayerRadius,
        ColliderHeight:GameConfig.PlayerColliderHeight,
        MaxStepHeight:GameConfig.MaxStepHeight,
        Skin:GameConfig.CollisionSkin,
        CanStep:this.VerticalVelocity <= 0.2
      }
    );

    this.MoveDirection.copy(Result.DesiredDirection);
    this.Position.x = Result.Position.x;
    this.Position.z = Result.Position.z;
    const ResolvedSpeed = Delta > 0.0001 ? Result.Resolved.length()/Delta : 0;
    this.LastSpeed = Moving ? Math.min(Speed,ResolvedSpeed) : 0;

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
    const FacingDirection = Result.Resolved.lengthSq() > 0.000001
      ? Result.Resolved
      : this.MoveDirection;

    if(Moving && FacingDirection.lengthSq() > 0.000001){
      const TargetFacing = Math.atan2(FacingDirection.x,FacingDirection.z);
      const Difference = NormalizeAngle(TargetFacing-this.LastFacing);
      TurnRate = Difference/Math.max(Delta,0.001);
      this.LastFacing += Difference*ExpAlpha(Delta,13);
    }

    this.CharacterRoot.position.copy(this.Position);
    this.CharacterRoot.rotation.y = this.LastFacing+this.ModelFacingOffset;
    this.Animator?.Update(Delta,this.LastSpeed,THREE.MathUtils.clamp(TurnRate,-4,4));
    this.UpdateLootBagTransform();
    this.UpdateToolVisual(Delta);
    this.CameraRig.SyncLogicalPosition(this.Position);
  }

  Render(Renderer,Scene){
    this.CameraRig.Render(Renderer,Scene,this.Position);
  }
}
