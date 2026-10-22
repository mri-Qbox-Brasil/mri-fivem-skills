# Vehicle targets (aim prompt on a car)

Pattern from the mri_Qbox modules `vehicledoors` (open, close, trunk items) and `entervehicle`. The target
system itself ships no vehicle options (mri_Qinteract keeps only `examples/vehicle-doors.lua`):
options live in a gameplay module, and options on one part compute the same anchor to share a prompt.

## Where each option sits

- One spot per part, so its options show in one prompt: open, close and enter share the door,
  open, close and the trunk items share the lid. An option with no bone or offset lands on the
  model's center, where nobody aims.
- Door: the handle bone (`handle_dside_f`), the hinge (`door_dside_f`) only for a model without a
  handle, the seat (`seat_dside_f`) only when the car has no such door. With the door open or torn
  off (`GetVehicleDoorAngleRatio > 0`, `IsVehicleDoorDamaged`) the handle has swung away: enter
  moves to the seat.
- One option per fallback bone, each with a `canInteract` that keeps only the first bone the model
  has (cache per model): a `bones` list shows the option on every bone it finds.
- Hood and trunk: the lid bone is the hinge; anchor between the hinge and the end of the model
  box at latch height.

## Text and behavior

- Only the verb ("Entrar", "Abrir", "Fechar", "Ver itens"): the spot already says which part.
  Never two options that read alike on one spot ("Abrir" the lid and "Abrir porta-malas").
- Enter goes to the seat of that door: driver -1, front passenger 0, rear 1 and 2.
  `TaskEnterVehicle` with -1 from any door walks to the nearest door and slides across. Hide it
  when `IsVehicleSeatFree` is false or the seat index is not below
  `GetVehicleMaxNumberOfPassengers`.

## Trunk inventory (ox_inventory)

- ox_inventory's own target (`inventory:target`) has no offset and checks 1.5 m from the car's
  end, so under a target system that anchors on the center it never shows. Add your own at the
  lid.
- Which lid holds the storage comes from ox_inventory's rules, read with
  `lib.load('@ox_inventory.data.vehicles')`: `Storage[model]` 0 or 1 = no trunk, any other value =
  the hood (door 4), absent = the boot (door 5); the class or model must be in `trunk`.
- Open with `exports.ox_inventory:openInventory('trunk', { netid, entityid = vehicle, door })` and
  open the lid when it returns true; ox_inventory shuts it on close. Keep the option within 1.5 m:
  farther, ox_inventory closes the inventory at once.
