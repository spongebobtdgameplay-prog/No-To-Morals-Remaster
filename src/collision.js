import * as THREE from "three";

function FiniteBounds(Bounds){
  return Boolean(Bounds?.min && Bounds?.max &&
    [Bounds.min.x,Bounds.min.y,Bounds.min.z,Bounds.max.x,Bounds.max.y,Bounds.max.z].every(Number.isFinite));
}

function VerticalOverlap(Bounds,MinY,MaxY){
  return MaxY > Bounds.min.y+0.0001 && MinY < Bounds.max.y-0.0001;
}

function SweepExpandedAabb(Start,Delta,Bounds,Radius){
  const MinX = Bounds.min.x-Radius;
  const MaxX = Bounds.max.x+Radius;
  const MinZ = Bounds.min.z-Radius;
  const MaxZ = Bounds.max.z+Radius;
  const Inside = Start.x > MinX && Start.x < MaxX && Start.z > MinZ && Start.z < MaxZ;

  if(Inside){
    const Distances = [
      {Value:Math.abs(Start.x-MinX),Normal:new THREE.Vector3(-1,0,0)},
      {Value:Math.abs(MaxX-Start.x),Normal:new THREE.Vector3(1,0,0)},
      {Value:Math.abs(Start.z-MinZ),Normal:new THREE.Vector3(0,0,-1)},
      {Value:Math.abs(MaxZ-Start.z),Normal:new THREE.Vector3(0,0,1)}
    ];
    Distances.sort((A,B)=>A.Value-B.Value);
    return {Time:0,Normal:Distances[0].Normal};
  }

  let Entry = -Infinity;
  let Exit = Infinity;
  let Normal = new THREE.Vector3();

  for(const Axis of ["x","z"]){
    const Origin = Start[Axis];
    const Direction = Delta[Axis];
    const Min = Axis === "x" ? MinX : MinZ;
    const Max = Axis === "x" ? MaxX : MaxZ;

    if(Math.abs(Direction) < 0.0000001){
      if(Origin < Min || Origin > Max) return null;
      continue;
    }

    let Near = (Min-Origin)/Direction;
    let Far = (Max-Origin)/Direction;
    let AxisNormal;

    if(Near > Far){
      [Near,Far] = [Far,Near];
      AxisNormal = Axis === "x" ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1);
    }else{
      AxisNormal = Axis === "x" ? new THREE.Vector3(-1,0,0) : new THREE.Vector3(0,0,-1);
    }

    if(Near > Entry){
      Entry = Near;
      Normal.copy(AxisNormal);
    }
    Exit = Math.min(Exit,Far);
    if(Entry > Exit) return null;
  }

  if(Entry < 0 || Entry > 1 || Exit < 0) return null;
  return {Time:Entry,Normal};
}

function SegmentExpandedBoundsHit(Start,End,Bounds,Padding){
  const Delta = End.clone().sub(Start);
  let Minimum = 0;
  let Maximum = 1;
  let HitAxis = "";
  let HitSign = 0;

  for(const Axis of ["x","y","z"]){
    const Origin = Start[Axis];
    const Direction = Delta[Axis];
    const Min = Bounds.min[Axis]-Padding;
    const Max = Bounds.max[Axis]+Padding;

    if(Math.abs(Direction) <= 0.0000001){
      if(Origin < Min || Origin > Max) return null;
      continue;
    }

    let Near = (Min-Origin)/Direction;
    let Far = (Max-Origin)/Direction;
    let NearSign = -1;
    if(Near > Far){
      [Near,Far] = [Far,Near];
      NearSign = 1;
    }

    if(Near > Minimum){
      Minimum = Near;
      HitAxis = Axis;
      HitSign = NearSign;
    }
    Maximum = Math.min(Maximum,Far);
    if(Minimum > Maximum) return null;
  }

  if(Minimum < 0 || Minimum > 1) return null;
  const Normal = new THREE.Vector3();
  if(HitAxis) Normal[HitAxis] = HitSign;
  return {Time:Minimum,Normal};
}

function VisibleCollisionMesh(Object){
  if(!Object?.isMesh || !Object.visible || !Object.geometry) return false;
  const Name = String(Object.name || "");
  if(/Text|Label|Glow|Highlight|Outline/i.test(Name)) return false;
  if(!Object.material) return true;
  const Materials = Array.isArray(Object.material) ? Object.material : [Object.material];
  return Materials.some(Material=>Material && Material.visible !== false && (!Material.transparent || Number(Material.opacity) > 0.08));
}

function HitNormal(Hit,Motion){
  const Normal = new THREE.Vector3();
  if(Hit?.face?.normal && Hit?.object?.matrixWorld){
    Normal.copy(Hit.face.normal).transformDirection(Hit.object.matrixWorld);
    Normal.y = 0;
    if(Normal.lengthSq() > 0.000001) Normal.normalize();
  }
  if(Normal.lengthSq() <= 0.000001) Normal.copy(Motion).normalize().multiplyScalar(-1);
  if(Normal.dot(Motion) > 0) Normal.multiplyScalar(-1);
  return Normal;
}

export class CollisionWorld{
  constructor(){
    this.Colliders = [];
    this.NextId = 1;
    this.Raycaster = new THREE.Raycaster();
    this.RayDirection = new THREE.Vector3();
    this.RaySide = new THREE.Vector3();
    this.RayOrigin = new THREE.Vector3();
  }

  AddBox(CenterX,CenterZ,Width,Depth,Type="Solid",Options={}){
    const Id = Options.Id || "Collider-"+this.NextId++;
    const MinY = Number.isFinite(Options.MinY) ? Options.MinY : 0;
    const MaxY = Number.isFinite(Options.MaxY) ? Options.MaxY : 6;
    const Collider = {
      Id,
      Type,
      Kind:"Box",
      Enabled:true,
      CameraBlock:Options.CameraBlock !== false,
      min:new THREE.Vector3(CenterX-Width/2,MinY,CenterZ-Depth/2),
      max:new THREE.Vector3(CenterX+Width/2,Math.max(MinY,MaxY),CenterZ+Depth/2)
    };
    this.Colliders.push(Collider);
    return Collider;
  }

  AddModel(Model,Type="Model",Options={}){
    if(!Model?.isObject3D) return null;
    Model.updateWorldMatrix(true,true);
    const Bounds = new THREE.Box3().setFromObject(Model);
    if(Bounds.isEmpty() || !FiniteBounds(Bounds)) return null;
    const Collider = {
      Id:Options.Id || "ModelCollider-"+this.NextId++,
      Type,
      Kind:"Model",
      Enabled:true,
      CameraBlock:Options.CameraBlock !== false,
      CollisionObject:Model,
      min:Bounds.min.clone(),
      max:Bounds.max.clone()
    };
    this.Colliders.push(Collider);
    return Collider;
  }

  Remove(Collider){
    if(Collider) Collider.Enabled = false;
  }

  IsActive(Collider){
    if(!Collider?.Enabled || !FiniteBounds(Collider)) return false;
    if(Collider.CollisionObject && (!Collider.CollisionObject.parent || !Collider.CollisionObject.visible)) return false;
    return true;
  }

  FindModelSweep(Start,Delta,Radius,Collider,MinY,MaxY){
    if(!VerticalOverlap(Collider,MinY,MaxY)) return null;
    const Distance = Math.hypot(Delta.x,Delta.z);
    if(Distance <= 0.000001) return null;

    this.RayDirection.set(Delta.x,0,Delta.z).normalize();
    this.RaySide.set(this.RayDirection.z,0,-this.RayDirection.x).normalize();
    const Height = Number.isFinite(MinY) && Number.isFinite(MaxY) ? Math.max(0.2,MaxY-MinY) : 1.68;
    const BaseY = Number.isFinite(MinY) ? MinY : Start.y-0.84;
    const HeightFractions = [0.07,0.16,0.29,0.45,0.63,0.81,0.94];
    const LateralRatios = [-0.94,-0.48,0,0.48,0.94];
    let Best = null;

    for(const HeightFraction of HeightFractions){
      const Y = BaseY+Height*HeightFraction;
      for(const Ratio of LateralRatios){
        const Lateral = Ratio*Radius;
        const Forward = Math.sqrt(Math.max(0,Radius*Radius-Lateral*Lateral));
        const OriginForward = Math.max(0,Forward-0.045);
        const BackOffset = Forward-OriginForward;
        this.RayOrigin.copy(Start)
          .addScaledVector(this.RaySide,Lateral)
          .addScaledVector(this.RayDirection,OriginForward);
        this.RayOrigin.y = Y;

        this.Raycaster.near = 0.0005;
        this.Raycaster.far = Distance+0.02;
        this.Raycaster.set(this.RayOrigin,this.RayDirection);
        const Hits = this.Raycaster.intersectObject(Collider.CollisionObject,true);

        for(const Hit of Hits){
          if(!VisibleCollisionMesh(Hit.object)) continue;
          const AllowedDistance = THREE.MathUtils.clamp(Hit.distance-BackOffset-0.008,0,Distance);
          const Time = AllowedDistance/Distance;
          if(!Best || Time < Best.Time){
            Best = {Time,Normal:HitNormal(Hit,this.RayDirection),Collider};
          }
          break;
        }
      }
    }

    return Best;
  }

  FindSweep(Start,Delta,Radius=0,CameraOnly=false,MinY=-Infinity,MaxY=Infinity){
    let Best = null;

    for(const Collider of this.Colliders){
      if(!this.IsActive(Collider)) continue;
      if(CameraOnly && !Collider.CameraBlock) continue;
      if(!VerticalOverlap(Collider,MinY,MaxY)) continue;

      const Hit = Collider.Kind === "Model"
        ? this.FindModelSweep(Start,Delta,Radius,Collider,MinY,MaxY)
        : SweepExpandedAabb(Start,Delta,Collider,Radius);
      if(!Hit) continue;
      if(!Best || Hit.Time < Best.Time) Best = Hit;
    }

    return Best;
  }

  TryStep(Start,Delta,Radius,MinY,MaxY,Hit,MaxStepHeight){
    const Collider = Hit?.Collider;
    if(!Collider) return null;
    const Top = Collider.max.y;
    const Rise = Top-MinY;
    if(Rise < -0.03 || Rise > MaxStepHeight+0.025) return null;
    const Height = Math.max(0.2,MaxY-MinY);
    const RaisedMinY = Top+0.025;
    const RaisedMaxY = RaisedMinY+Height;
    if(this.FindSweep(Start,Delta,Radius,false,RaisedMinY,RaisedMaxY)) return null;
    return {Position:Start.clone().add(Delta),Hit,Stepped:true,StepHeight:Top};
  }

  ResolveMove(Start,Delta,Radius,Vertical=null){
    const Position = Start.clone();
    const Desired = Delta.clone();
    Desired.y = 0;
    let Remaining = Desired.clone();
    const Skin = Math.max(0.002,Number(Vertical?.Skin) || 0.008);
    const MinY = Number.isFinite(Vertical?.MinY) ? Vertical.MinY : -Infinity;
    const MaxY = Number.isFinite(Vertical?.MaxY) ? Vertical.MaxY : Infinity;
    const MaxStepHeight = Number.isFinite(Vertical?.MaxStepHeight) ? Vertical.MaxStepHeight : 0.32;
    const AllowSlide = Vertical?.AllowSlide !== false;
    let LastHit = null;

    const FirstHit = this.FindSweep(Position,Remaining,Radius,false,MinY,MaxY);
    if(FirstHit && Number.isFinite(MinY) && Number.isFinite(MaxY)){
      const Step = this.TryStep(Position,Remaining,Radius,MinY,MaxY,FirstHit,MaxStepHeight);
      if(Step) return Step;
    }

    for(let Iteration=0;Iteration<4;Iteration+=1){
      if(Remaining.lengthSq() < 0.0000001) break;
      const Hit = this.FindSweep(Position,Remaining,Radius,false,MinY,MaxY);
      if(!Hit){
        Position.add(Remaining);
        Remaining.set(0,0,0);
        break;
      }

      LastHit = Hit;
      const Length = Math.max(Remaining.length(),0.0001);
      const SafeTime = Math.max(0,Hit.Time-Skin/Length);
      Position.addScaledVector(Remaining,SafeTime);

      if(!AllowSlide){
        Remaining.set(0,0,0);
        break;
      }

      const Left = Remaining.clone().multiplyScalar(1-SafeTime);
      const Into = Left.dot(Hit.Normal);
      if(Into < 0) Left.addScaledVector(Hit.Normal,-Into);
      const Tangent = Desired.clone();
      Tangent.addScaledVector(Hit.Normal,-Tangent.dot(Hit.Normal));
      if(Tangent.lengthSq() <= 0.000001 || Left.dot(Tangent) <= 0){
        Remaining.set(0,0,0);
        break;
      }
      Remaining.copy(Left).multiplyScalar(0.995);
    }

    return {Position,Hit:LastHit,Stepped:false,StepHeight:null};
  }

  ResolveSegment(Start,End,Radius=0.06,Filter=null){
    let Best = null;

    for(const Collider of this.Colliders){
      if(!this.IsActive(Collider)) continue;
      if(Filter && !Filter(Collider)) continue;
      const Hit = SegmentExpandedBoundsHit(Start,End,Collider,Radius);
      if(!Hit) continue;
      if(!Best || Hit.Time < Best.Time) Best = {Time:Hit.Time,Normal:Hit.Normal,Collider};
    }

    if(!Best) return {Hit:false,End:End.clone(),Normal:new THREE.Vector3(),Collider:null};
    const Delta = End.clone().sub(Start);
    const Length = Math.max(Delta.length(),0.0001);
    const SafeTime = Math.max(0,Best.Time-0.006/Length);
    const SafeEnd = Start.clone().addScaledVector(Delta,SafeTime);
    SafeEnd.addScaledVector(Best.Normal,0.004);
    return {Hit:true,End:SafeEnd,Normal:Best.Normal.clone(),Collider:Best.Collider};
  }

  FindLandingHeight(Position,Radius,PreviousFeetY,NextFeetY){
    let BestHeight = 0;
    let Found = NextFeetY <= 0 && PreviousFeetY >= -0.06;

    for(const Collider of this.Colliders){
      if(!this.IsActive(Collider)) continue;
      const Top = Collider.max.y;
      if(Top > PreviousFeetY+0.08 || Top < NextFeetY-0.015) continue;

      const ClosestX = THREE.MathUtils.clamp(Position.x,Collider.min.x,Collider.max.x);
      const ClosestZ = THREE.MathUtils.clamp(Position.z,Collider.min.z,Collider.max.z);
      const DX = Position.x-ClosestX;
      const DZ = Position.z-ClosestZ;
      if(DX*DX+DZ*DZ > Radius*Radius) continue;

      if(!Found || Top > BestHeight){
        BestHeight = Top;
        Found = true;
      }
    }

    return Found ? BestHeight : null;
  }

  ClipSegment(Start,Desired,Radius=0.12){
    let Best = null;

    for(const Collider of this.Colliders){
      if(!this.IsActive(Collider) || !Collider.CameraBlock) continue;
      const Hit = SegmentExpandedBoundsHit(Start,Desired,Collider,Radius);
      if(!Hit) continue;
      if(!Best || Hit.Time < Best.Time) Best = Hit;
    }

    if(!Best) return Desired.clone();
    const Delta = Desired.clone().sub(Start);
    const Distance = Math.max(Delta.length(),0.001);
    const SafeTime = Math.max(0,Best.Time-0.08/Distance);
    return Start.clone().addScaledVector(Delta,SafeTime);
  }
}
