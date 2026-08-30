import * as THREE from "three";
import {GameConfig} from "./config.js?v=20260830-v012b";

export class VaultSystem{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.DoorModel = null;
    this.Open = false;
    this.Progress = 0;
    this.RequiredSteps = 3;
    this.AlarmTriggered = false;
    this.InteractionPoint = new THREE.Vector3(0,0,-3.45);
    this.DoorCollider = this.Collision.AddBox(
      0,
      -4,
      2.2,
      0.4,
      "SecurityGate",
      {
        Id:"SecurityGate",
        MinY:0,
        MaxY:3.05
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

        Material.emissive.setHex(0x1e8a72);
        Material.emissiveIntensity = 0.9;
      }
    });

    setTimeout(()=>{
      for(const Entry of Restore){
        Entry.Material.emissive.copy(Entry.Emissive);
        Entry.Material.emissiveIntensity = Entry.Intensity;
      }
    },110);
  }

  OpenDoor(){
    if(this.Open) return;

    this.Open = true;
    this.Progress = this.RequiredSteps;
    this.Collision.Remove(this.DoorCollider);

    if(this.DoorModel){
      this.DoorModel.visible = false;
    }
  }

  UpdateInteraction(Player,Ui,Enabled){
    if(this.Open || !Enabled) return false;

    const Distance = Player.Position.distanceTo(this.InteractionPoint);

    if(Distance > 1.7) return false;

    Ui.SetPrompt("E  OVERRIDE SECURITY GATE");

    if(!Player.ConsumeInteract()) return false;

    this.Progress = Math.min(this.RequiredSteps,this.Progress+1);
    this.AlarmTriggered = true;
    this.FlashDoor();

    if(this.Progress >= this.RequiredSteps){
      this.OpenDoor();
    }

    return true;
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
    return 1-this.Progress/this.RequiredSteps;
  }
}

export class GearSystem{
  constructor(World){
    this.World = World;
    this.Position = World.GearPosition.clone();
    this.Equipped = false;
  }

  Update(Player,Ui){
    if(this.Equipped) return false;

    const Distance = Player.Position.distanceTo(this.Position);

    if(Distance > 1.65) return false;

    Ui.SetPrompt("E  GET ACCESS DEVICE");

    if(!Player.ConsumeInteract()) return false;

    this.Equipped = true;

    if(this.World.GearDisplay){
      this.World.GearDisplay.visible = false;
    }

    Ui.SetObjective("Reach the security gate.");
    return true;
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
    Player.UpdateLootBag(this.Count/GameConfig.LootCount);
    Ui.SetLoot(this.Count,GameConfig.LootCount);
    Ui.SetPickupFeedback("LOOT SECURED  +$"+GameConfig.LootValue.toLocaleString());
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
    if(Unit.Root.position.z > 10.4 && Player.Position.z < 9.6){
      return new THREE.Vector3(0,0,10.8);
    }

    if(Unit.Root.position.z > -4.2 && Player.Position.z < -4.25){
      const PassageX = this.Vault.GetPassageX();
      return new THREE.Vector3(Number.isFinite(PassageX) ? PassageX : 0,0,-3.55);
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
    this.PickupFeedback = document.getElementById("PickupFeedback");
    this.PickupTimeout = null;
  }

  SetPrompt(Text){ this.InteractPrompt.textContent = Text || ""; }
  SetObjective(Text){ this.ObjectiveText.textContent = Text; }
  SetLoot(Current,Total){ this.LootText.textContent = Current+" / "+Total; }
  SetStamina(Value){ this.StaminaFill.style.width = THREE.MathUtils.clamp(Value,0,100)+"%"; }
  SetPickupFeedback(Text){
    this.PickupFeedback.textContent = Text;
    this.PickupFeedback.classList.add("Visible");
    clearTimeout(this.PickupTimeout);
    this.PickupTimeout = setTimeout(()=>this.PickupFeedback.classList.remove("Visible"),900);
  }

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
        : "RESPONSE TEAM ON SCENE";
    }
  }

  End(Win,Loot){
    this.Hud.classList.add("Hidden");
    this.EndScreen.classList.remove("Hidden");
    this.EndTitle.textContent = Win ? "ESCAPED" : "CAUGHT";
    this.EndTitle.style.color = Win ? "var(--green)" : "var(--alarm)";
    this.EndText.textContent = Win
      ? "You made it out with "+Loot+" loot crate"+(Loot===1?"":"s")+"."
      : "The response team reached you. Loot secured: "+Loot+".";
  }

  Error(Error){
    this.ErrorPanel.textContent = String(Error && Error.message ? Error.message : Error);
    this.ErrorPanel.classList.remove("Hidden");
  }
}
