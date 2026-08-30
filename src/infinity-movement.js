import * as THREE from "three";

export class InfinityMovementController{
  constructor(Camera,Collision){
    this.Camera = Camera;
    this.Collision = Collision;
    this.Forward = new THREE.Vector3();
    this.Right = new THREE.Vector3();
    this.Desired = new THREE.Vector3();
    this.DesiredDirection = new THREE.Vector3();
    this.StepDelta = new THREE.Vector3();
    this.Start = new THREE.Vector3();
    this.Working = new THREE.Vector3();
    this.Resolved = new THREE.Vector3();
  }

  ReadInput(Keys){
    let Forward = 0;
    let Right = 0;

    if(Keys.has("KeyW")) Forward += 1;
    if(Keys.has("KeyS")) Forward -= 1;
    if(Keys.has("KeyD")) Right += 1;
    if(Keys.has("KeyA")) Right -= 1;

    const Length = Math.hypot(Forward,Right);
    if(Length > 0.000001){
      Forward /= Length;
      Right /= Length;
    }

    return {
      Forward,
      Right,
      Moving:Length > 0.000001
    };
  }

  CameraBasis(){
    this.Forward.set(0,0,-1).applyQuaternion(this.Camera.quaternion);
    this.Forward.y = 0;

    if(this.Forward.lengthSq() <= 0.000001){
      this.Forward.set(0,0,-1);
    }else{
      this.Forward.normalize();
    }

    this.Right.set(1,0,0).applyQuaternion(this.Camera.quaternion);
    this.Right.y = 0;

    if(this.Right.lengthSq() <= 0.000001){
      this.Right.set(1,0,0);
    }else{
      this.Right.normalize();
    }
  }

  Move(Start,ForwardAmount,RightAmount,Distance,Options={}){
    this.CameraBasis();
    this.Desired.set(0,0,0)
      .addScaledVector(this.Forward,Number(ForwardAmount) || 0)
      .addScaledVector(this.Right,Number(RightAmount) || 0);

    this.Start.copy(Start);

    if(this.Desired.lengthSq() <= 0.000001 || !Number.isFinite(Distance) || Distance <= 0){
      return {
        Position:Start.clone(),
        Resolved:new THREE.Vector3(),
        DesiredDirection:new THREE.Vector3(),
        Hit:null,
        Stepped:false,
        StepHeight:null
      };
    }

    this.Desired.normalize();
    this.DesiredDirection.copy(this.Desired);

    const Radius = THREE.MathUtils.clamp(Number(Options.Radius) || 0.255,0.20,0.34);
    const Skin = Math.max(0.002,Number(Options.Skin) || 0.006);
    const ColliderHeight = Math.max(0.8,Number(Options.ColliderHeight) || 1.68);
    const MaxStepHeight = Options.CanStep === false
      ? 0
      : THREE.MathUtils.clamp(Number(Options.MaxStepHeight) || 0.30,0,0.45);
    const StepLength = Math.max(0.055,Radius*0.52);
    const StepCount = THREE.MathUtils.clamp(Math.ceil(Distance/StepLength),1,8);
    const DistancePerStep = Distance/StepCount;

    this.Working.copy(Start);
    let CollisionFeetY = Start.y;
    let LastHit = null;
    let Stepped = false;
    let StepHeight = null;

    for(let Index=0;Index<StepCount;Index+=1){
      this.StepDelta.copy(this.DesiredDirection).multiplyScalar(DistancePerStep);

      const Result = this.Collision.ResolveMove(
        this.Working,
        this.StepDelta,
        Radius,
        {
          MinY:CollisionFeetY+0.035,
          MaxY:CollisionFeetY+ColliderHeight,
          MaxStepHeight,
          Skin,
          AllowSlide:true
        }
      );

      this.Working.x = Result.Position.x;
      this.Working.z = Result.Position.z;

      if(Result.Hit) LastHit = Result.Hit;

      if(Result.Stepped && Number.isFinite(Result.StepHeight)){
        CollisionFeetY = Math.max(CollisionFeetY,Result.StepHeight);
        Stepped = true;
        StepHeight = Number.isFinite(StepHeight)
          ? Math.max(StepHeight,Result.StepHeight)
          : Result.StepHeight;
      }
    }

    this.Working.y = Start.y;
    this.Resolved.copy(this.Working).sub(Start);
    this.Resolved.y = 0;

    return {
      Position:this.Working.clone(),
      Resolved:this.Resolved.clone(),
      DesiredDirection:this.DesiredDirection.clone(),
      Hit:LastHit,
      Stepped,
      StepHeight
    };
  }
}
