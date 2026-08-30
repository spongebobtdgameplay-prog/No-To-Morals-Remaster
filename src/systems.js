import * as THREE from "three";
import {GameConfig} from "./config.js";

export class VaultSystem{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.DoorModel = null;
    this.MaxIntegrity = 12;
    this.Integrity = this.MaxIntegrity;
    this.Open = false;
    this.LastPulse = -99;
    this.AlarmTriggered = false;
    this.DoorCollider = this.Collision.AddBox(
      0,
      -5.72,
      5.1,
      0.46,
      "VaultDoor",
      {
        Id:"VaultDoor",
        MinY:0,
        MaxY:4.3
      }
    );
  }

  AttachDoor(Model){
    this.DoorModel = Model || null;
    return this;
  }

  FlashDoor(){
    if(!this.DoorModel) return;

    const Restore = [];

    this.DoorModel.traverse(Object=>{
      if(!Object?.isMesh || !Object.material) return;
      const Materials = Array.isArray(Object.material) ? Object.material : [Object.material];

      for(const Material of Materials){
        if(!Material?.emissive?.isColor) continue;

        Restore.push({
          Material,
          Emissive:Material.emissive.clone(),
          Intensity:Number(Material.emissiveIntensity) || 0
        });

        Material.emissive.setHex(0x8f3a18);
        Material.emissiveIntensity = 0.72;
      }
    });

    setTimeout(()=>{
      for(const Entry of Restore){
        Entry.Material.emissive.copy(Entry.Emissive);
        Entry.Material.emissiveIntensity = Entry.Intensity;
      }
    },80);
  }

  OpenDoor(){
    if(this.Open) return;

    this.Open = true;
    this.Integrity = 0;
    this.Collision.Remove(this.DoorCollider);

    if(this.DoorModel){
      this.DoorModel.visible = false;
    }
  }

  Pulse(Player){
    const Now = performance.now()/1000;

    if(Now-this.LastPulse < GameConfig.BreachCooldown){
      return {Fired:false};
    }

    this.LastPulse = Now;

    if(this.Open || !this.DoorModel){
      return {Fired:true,Hit:false};
    }

    const Ray = Player.GetAimRay();
    const Raycaster = new THREE.Raycaster(Ray.Origin,Ray.Direction,0,25);
    const Hits = Raycaster.intersectObject(this.DoorModel,true);

    if(!Hits.length){
      return {Fired:true,Hit:false};
    }

    this.AlarmTriggered = true;
    this.Integrity = Math.max(0,this.Integrity-1);
    this.FlashDoor();

    if(this.Integrity <= 0){
      this.OpenDoor();
    }

    return {
      Fired:true,
      Hit:true,
      Point:Hits[0].point.clone()
    };
  }

  Update(){
  }

  GetPassageX(){
    return this.Open ? 0 : null;
  }

  IsPassable(){
    return this.Open;
  }

  RemainingFraction(){
    return this.Integrity/this.MaxIntegrity;
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
        Player.EquipBreachTool(this.World.CreateBreachGear());
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
    let Closest = null;
    let ClosestDistance = Infinity;

    for(const Loot of this.World.Loot){
      if(Loot.userData.Collected) continue;

      const Distance = Player.Position.distanceTo(Loot.position);

      if(Distance < 1.35 && Distance < ClosestDistance){
        Closest = Loot;
        ClosestDistance = Distance;
      }
    }

    if(!Closest) return;

    Ui.SetPrompt("E  TAKE LOOT");

    if(!Player.ConsumeInteract()) return;

    Closest.userData.Collected = true;
    Closest.visible = false;
    this.Count += 1;
    Ui.SetLoot(this.Count,GameConfig.LootCount);
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
        const Result = this.Collision.ResolveMove(
          Unit.Root.position,
          Move,
          0.33,
          {MinY:0.04,MaxY:1.68}
        );

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
    this.ErrorPanel.classList.add("Hidden");
    this.StartButton.disabled = false;
    this.StartButton.textContent = "START THE JOB";
    this.BootStatus.textContent = "Ready.";
  }

  SetBootFailure(Error){
    const Message = String(Error?.message || Error || "Unknown loading error.");
    this.StartButton.disabled = true;
    this.StartButton.textContent = "LOAD FAILED";
    this.BootStatus.textContent = "Required game models failed to load.";
    this.ErrorPanel.textContent = Message;
    this.ErrorPanel.classList.remove("Hidden");
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
