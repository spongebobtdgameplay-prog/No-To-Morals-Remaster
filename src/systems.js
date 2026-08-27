import * as THREE from "three";
import {GameConfig} from "./config.js";
import {CreateBreachTool} from "./breach-tool.js";

export class VaultSystem{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Cells = [];
    this.Columns = [];
    this.Fragments = [];
    this.CellGroup = new THREE.Group();
    this.Scene.add(this.CellGroup);
    this.LastPulse = -99;
    this.AlarmTriggered = false;
    this.Build();
  }

  Build(){
    const TotalWidth = GameConfig.VaultColumns*GameConfig.VaultCellWidth;
    const TotalHeight = GameConfig.VaultRows*GameConfig.VaultCellHeight;
    const StartX = -TotalWidth/2+GameConfig.VaultCellWidth/2;
    const StartY = GameConfig.VaultCellHeight/2;
    const DoorZ = -5.72;

    const FrameMaterial = new THREE.MeshStandardMaterial({color:0x575f66,roughness:0.34,metalness:0.72});
    const CellMaterial = new THREE.MeshStandardMaterial({color:0x6d777e,roughness:0.3,metalness:0.78});
    const DarkMaterial = new THREE.MeshStandardMaterial({color:0x252c31,roughness:0.42,metalness:0.65});

    const FrameParts = [
      {x:0,y:TotalHeight+0.18,z:DoorZ,w:TotalWidth+0.65,h:0.36,d:0.48},
      {x:0,y:0.12,z:DoorZ,w:TotalWidth+0.65,h:0.24,d:0.48},
      {x:-TotalWidth/2-0.18,y:TotalHeight/2,z:DoorZ,w:0.36,h:TotalHeight,d:0.48},
      {x:TotalWidth/2+0.18,y:TotalHeight/2,z:DoorZ,w:0.36,h:TotalHeight,d:0.48}
    ];

    for(const Part of FrameParts){
      const Mesh = new THREE.Mesh(new THREE.BoxGeometry(Part.w,Part.h,Part.d),FrameMaterial);
      Mesh.position.set(Part.x,Part.y,Part.z);
      Mesh.castShadow = true;
      Mesh.receiveShadow = true;
      this.Scene.add(Mesh);
    }

    for(let Column=0;Column<GameConfig.VaultColumns;Column+=1){
      const X = StartX+Column*GameConfig.VaultCellWidth;
      const Collider = this.Collision.AddBox(
        X,
        DoorZ,
        GameConfig.VaultCellWidth*0.92,
        GameConfig.VaultThickness,
        "VaultDoorColumn",
        {Id:"VaultColumn-"+Column}
      );

      const ColumnData = {
        Collider,
        DestroyedRows:new Set(),
        Open:false,
        X
      };
      this.Columns.push(ColumnData);

      for(let Row=0;Row<GameConfig.VaultRows;Row+=1){
        const Mesh = new THREE.Mesh(
          new THREE.BoxGeometry(
            GameConfig.VaultCellWidth*0.92,
            GameConfig.VaultCellHeight*0.92,
            GameConfig.VaultThickness
          ),
          (Column+Row)%2 === 0 ? CellMaterial.clone() : DarkMaterial.clone()
        );
        Mesh.position.set(X,StartY+Row*GameConfig.VaultCellHeight,DoorZ);
        Mesh.castShadow = true;
        Mesh.receiveShadow = true;
        Mesh.userData.VaultCell = true;
        Mesh.userData.CellIndex = this.Cells.length;
        this.CellGroup.add(Mesh);
        this.Cells.push({Mesh,Column,Row,Integrity:2,Destroyed:false});
      }
    }

    const Wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.72,0.08,10,24),
      new THREE.MeshStandardMaterial({color:0x252b30,metalness:0.82,roughness:0.28})
    );
    Wheel.position.set(0,2.1,DoorZ-0.18);
    this.Scene.add(Wheel);
  }

  OpenColumnIfWalkable(Column){
    if(Column.Open) return;
    const RequiredRows = [0,1,2,3];
    if(!RequiredRows.every(Row=>Column.DestroyedRows.has(Row))) return;
    Column.Open = true;
    this.Collision.Remove(Column.Collider);
  }

  SpawnFragments(Cell,HitPoint){
    const Base = Cell.Mesh.position;
    for(let Index=0;Index<3;Index+=1){
      const Size = 0.075+Math.random()*0.085;
      const Fragment = new THREE.Mesh(
        new THREE.BoxGeometry(Size,Size*(0.65+Math.random()*0.6),Size*0.55),
        new THREE.MeshStandardMaterial({
          color:Index%2 === 0 ? 0x69737a : 0x30383e,
          roughness:0.4,
          metalness:0.7
        })
      );
      Fragment.position.copy(Base);
      Fragment.position.x += (Math.random()-0.5)*0.2;
      Fragment.position.y += (Math.random()-0.5)*0.18;
      Fragment.castShadow = true;
      this.Scene.add(Fragment);

      const Away = Fragment.position.clone().sub(HitPoint);
      if(Away.lengthSq() < 0.001) Away.set(Math.random()-0.5,Math.random()*0.4,1);
      Away.normalize();

      this.Fragments.push({
        Mesh:Fragment,
        Velocity:Away.multiplyScalar(1.2+Math.random()*1.6).add(new THREE.Vector3(0,1.1+Math.random(),0)),
        Spin:new THREE.Vector3(
          (Math.random()-0.5)*6,
          (Math.random()-0.5)*6,
          (Math.random()-0.5)*6
        ),
        Age:0,
        Life:1.15+Math.random()*0.45
      });
    }
  }

  DestroyCell(Cell,HitPoint){
    Cell.Destroyed = true;
    Cell.Mesh.visible = false;
    const Column = this.Columns[Cell.Column];
    Column.DestroyedRows.add(Cell.Row);
    this.OpenColumnIfWalkable(Column);
    this.SpawnFragments(Cell,HitPoint);
  }

  Pulse(Player){
    const Now = performance.now()/1000;
    if(Now-this.LastPulse < GameConfig.BreachCooldown) return {Fired:false};
    this.LastPulse = Now;

    const Ray = Player.GetAimRay();
    const Raycaster = new THREE.Raycaster(Ray.Origin,Ray.Direction,0,25);
    const Targets = this.Cells.filter(Cell=>!Cell.Destroyed).map(Cell=>Cell.Mesh);
    const Hits = Raycaster.intersectObjects(Targets,false);

    if(!Hits.length){
      const End = Ray.Origin.clone().addScaledVector(Ray.Direction,18);
      this.MakePulseEffect(Ray.Origin,End);
      return {Fired:true,Hit:false};
    }

    const HitPoint = Hits[0].point;
    this.AlarmTriggered = true;

    const ScratchPosition = new THREE.Vector3();
    for(const Cell of this.Cells){
      if(Cell.Destroyed) continue;
      const Distance = Cell.Mesh.getWorldPosition(ScratchPosition).distanceTo(HitPoint);
      if(Distance > GameConfig.BreachRadius) continue;

      const Damage = Distance < GameConfig.BreachRadius*0.38 ? 2 : 1;
      Cell.Integrity -= Damage;
      Cell.Mesh.material.emissive = new THREE.Color(0x6a2e14);
      Cell.Mesh.material.emissiveIntensity = 0.65;

      if(Cell.Integrity <= 0) this.DestroyCell(Cell,HitPoint);
    }

    this.MakePulseEffect(Ray.Origin,HitPoint);
    return {Fired:true,Hit:true,Point:HitPoint};
  }

  MakePulseEffect(Start,End){
    const Geometry = new THREE.BufferGeometry().setFromPoints([Start,End]);
    const Material = new THREE.LineBasicMaterial({color:0x66d4ff,transparent:true,opacity:0.95});
    const Line = new THREE.Line(Geometry,Material);
    this.Scene.add(Line);

    setTimeout(()=>{
      this.Scene.remove(Line);
      Geometry.dispose();
      Material.dispose();
    },70);
  }

  Update(Delta){
    for(let Index=this.Fragments.length-1;Index>=0;Index-=1){
      const Fragment = this.Fragments[Index];
      Fragment.Age += Delta;
      Fragment.Velocity.y -= 5.8*Delta;
      Fragment.Mesh.position.addScaledVector(Fragment.Velocity,Delta);
      Fragment.Mesh.rotation.x += Fragment.Spin.x*Delta;
      Fragment.Mesh.rotation.y += Fragment.Spin.y*Delta;
      Fragment.Mesh.rotation.z += Fragment.Spin.z*Delta;

      if(Fragment.Mesh.position.y < 0.06){
        Fragment.Mesh.position.y = 0.06;
        Fragment.Velocity.y = Math.abs(Fragment.Velocity.y)*0.25;
        Fragment.Velocity.x *= 0.72;
        Fragment.Velocity.z *= 0.72;
      }

      if(Fragment.Age >= Fragment.Life){
        this.Scene.remove(Fragment.Mesh);
        Fragment.Mesh.geometry.dispose();
        Fragment.Mesh.material.dispose();
        this.Fragments.splice(Index,1);
      }
    }
  }

  GetPassageX(){
    let Start = -1;
    let BestStart = -1;
    let BestLength = 0;

    for(let Index=0;Index<=this.Columns.length;Index+=1){
      const Open = Index < this.Columns.length && this.Columns[Index].Open;
      if(Open && Start < 0) Start = Index;

      if((!Open || Index === this.Columns.length) && Start >= 0){
        const Length = Index-Start;
        if(Length > BestLength){
          BestLength = Length;
          BestStart = Start;
        }
        Start = -1;
      }
    }

    if(BestLength < 2) return null;
    const Left = this.Columns[BestStart].X;
    const Right = this.Columns[BestStart+BestLength-1].X;
    return (Left+Right)*0.5;
  }

  IsPassable(){
    return Number.isFinite(this.GetPassageX());
  }

  RemainingFraction(){
    const Remaining = this.Cells.filter(Cell=>!Cell.Destroyed).length;
    return Remaining/this.Cells.length;
  }
}

export class GearSystem{
  constructor(World){
    this.World = World;
    this.Position = World.GearPosition.clone();
    this.Equipped = false;
  }

  Update(Player,Ui){
    const Distance = Player.Position.distanceTo(this.Position);

    if(!this.Equipped && Distance < 2.1){
      Ui.SetPrompt("E  TAKE BREACH TOOL");
      if(Player.ConsumeInteract()){
        this.Equipped = true;
        if(this.World.GearDisplay) this.World.GearDisplay.visible = false;
        Player.EquipBreachTool(CreateBreachTool());
        Ui.SetObjective("Breach the vault surface.");
      }
      return;
    }

    if(!this.Equipped){
      Player.ConsumeInteract();
      return;
    }

    if(Player.Position.z < 1.5){
      Ui.SetPrompt("LEFT CLICK  BREACH PULSE");
    }
  }
}

export class LootSystem{
  constructor(World){
    this.World = World;
    this.Count = 0;
  }

  Update(Player,Ui){
    for(const Bag of this.World.Loot){
      if(Bag.userData.Collected) continue;
      if(Player.Position.distanceTo(Bag.position) < 1.0){
        Bag.userData.Collected = true;
        Bag.visible = false;
        this.Count += 1;
        Ui.SetLoot(this.Count,GameConfig.LootCount);
      }
    }
  }
}

export class PoliceSystem{
  constructor(Scene,Collision,Assets,World,Vault){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Assets = Assets;
    this.World = World;
    this.Vault = Vault;
    this.Units = [];
    this.Deployed = false;
  }

  Deploy(){
    if(this.Deployed) return;
    this.Deployed = true;

    for(let Index=0;Index<this.World.PoliceSpawns.length;Index+=1){
      const Character = this.Assets.Create("Police");
      const Root = new THREE.Group();
      Root.add(Character.Model);
      Root.position.copy(this.World.PoliceSpawns[Index]);
      this.Scene.add(Root);

      this.Units.push({
        Root,
        Animator:Character.Animator,
        Speed:2.7+Index*0.12,
        Facing:Math.PI
      });
    }
  }

  RouteTarget(Unit,Player){
    if(Unit.Root.position.z > 12.3 && Player.Position.z < 11.5){
      return new THREE.Vector3(0,0,13.3);
    }

    if(Unit.Root.position.z > -6.15 && Player.Position.z < -6.2){
      const PassageX = this.Vault.GetPassageX();
      return new THREE.Vector3(Number.isFinite(PassageX) ? PassageX : 0,0,-5.35);
    }

    return Player.Position.clone();
  }

  Update(Delta,Player){
    if(!this.Deployed) return false;

    for(const Unit of this.Units){
      const Target = this.RouteTarget(Unit,Player);
      const Direction = Target.sub(Unit.Root.position);
      Direction.y = 0;
      const Distance = Direction.length();

      if(Distance > 0.05){
        Direction.normalize();
        const Move = Direction.clone().multiplyScalar(Unit.Speed*Delta);
        const Result = this.Collision.ResolveMove(Unit.Root.position,Move,0.33);
        Unit.Root.position.x = Result.Position.x;
        Unit.Root.position.z = Result.Position.z;
        const Facing = Math.atan2(Direction.x,Direction.z);
        Unit.Facing = THREE.MathUtils.lerp(Unit.Facing,Facing,1-Math.exp(-10*Delta));
        Unit.Root.rotation.y = Unit.Facing;
        Unit.Animator.Update(Delta,Unit.Speed,0);
      }

      if(Unit.Root.position.distanceTo(Player.Position) < 1.05) return true;
    }

    return false;
  }
}

export class GameUi{
  constructor(){
    this.Hud = document.getElementById("Hud");
    this.ObjectiveText = document.getElementById("ObjectiveText");
    this.LootText = document.getElementById("LootText");
    this.StaminaFill = document.getElementById("StaminaFill");
    this.InteractPrompt = document.getElementById("InteractPrompt");
    this.AlarmPanel = document.getElementById("AlarmPanel");
    this.ResponseText = document.getElementById("ResponseText");
    this.StartScreen = document.getElementById("StartScreen");
    this.StartButton = document.getElementById("StartButton");
    this.BootStatus = document.getElementById("BootStatus");
    this.EndScreen = document.getElementById("EndScreen");
    this.EndTitle = document.getElementById("EndTitle");
    this.EndText = document.getElementById("EndText");
    this.RestartButton = document.getElementById("RestartButton");
    this.ErrorPanel = document.getElementById("ErrorPanel");
  }

  SetPrompt(Text){ this.InteractPrompt.textContent = Text || ""; }
  SetObjective(Text){ this.ObjectiveText.textContent = Text; }
  SetLoot(Current,Total){ this.LootText.textContent = Current+" / "+Total; }
  SetStamina(Value){ this.StaminaFill.style.width = THREE.MathUtils.clamp(Value,0,100)+"%"; }

  SetReady(){
    this.StartButton.disabled = false;
    this.StartButton.textContent = "START THE JOB";
    this.BootStatus.textContent = "Ready.";
  }

  Start(){
    this.StartScreen.classList.add("Hidden");
    this.Hud.classList.remove("Hidden");
  }

  SetAlarm(Active,Seconds){
    this.AlarmPanel.classList.toggle("Hidden",!Active);
    if(Active){
      this.ResponseText.textContent = Seconds > 0
        ? "RESPONSE WAVE IN "+Seconds.toFixed(1)
        : "POLICE ON SCENE";
    }
  }

  End(Win,Loot){
    this.Hud.classList.add("Hidden");
    this.EndScreen.classList.remove("Hidden");
    this.EndTitle.textContent = Win ? "ESCAPED" : "CAUGHT";
    this.EndTitle.style.color = Win ? "var(--green)" : "var(--alarm)";
    this.EndText.textContent = Win
      ? "You made it out with "+Loot+" loot bag"+(Loot===1?"":"s")+"."
      : "The response team reached you. Loot secured: "+Loot+".";
  }

  Error(Error){
    this.ErrorPanel.textContent = String(Error && Error.message ? Error.message : Error);
    this.ErrorPanel.classList.remove("Hidden");
  }
}
