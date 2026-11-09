-- My Ritualist Overlay: Path of Building 2 without its window.
--
-- Started by main/src/atziri-pob.ts with the Path of Building folder as the
-- current folder:  luajit.exe pob-server.lua <engine dir> <user data dir>
-- Protocol: one JSON command per line on stdin, one JSON answer per line on
-- stdout. Everything Path of Building prints goes to stderr.
--   {"cmd":"load","xml":"<PathOfBuilding2>...","skill":"Glacial Lance"}
--   {"cmd":"skill","index":5}
--   {"cmd":"compare","item":"Rarity: RARE\n..."}

local engineDir, userDir = arg[1], arg[2]
local stdout = io.stdout

-- Lua libraries of Path of Building: "lua/" in an installed copy,
-- "../runtime/lua/" in the source repository
package.path = "lua/?.lua;lua/?/init.lua;../runtime/lua/?.lua;../runtime/lua/?/init.lua;"
  .. package.path

-- "lua-utf8" is a native module only used to format numbers for display:
-- the plain string functions are enough here
package.preload["lua-utf8"] = function()
  return setmetatable({}, { __index = string })
end

-- Path of Building files start with a "#@" marker line that plain LuaJIT
-- does not skip
local rawLoadfile = loadfile
function loadfile(path, ...)
  local f = io.open(path, "rb")
  if not f then
    return rawLoadfile(path, ...)
  end
  local text = f:read("*a")
  f:close()
  if text:sub(1, 1) == "#" then
    text = text:gsub("^[^\n]*", "", 1)
  end
  return loadstring(text, "@" .. path)
end
function dofile(path)
  return assert(loadfile(path))()
end

-- Path of Building talks a lot: keep stdout for the answers
print = function(...)
  local parts = {}
  for i = 1, select("#", ...) do
    parts[#parts + 1] = tostring((select(i, ...)))
  end
  io.stderr:write(table.concat(parts, " "), "\n")
end

-- Same set-up as Path of Building's HeadlessWrapper.lua, with the user
-- folder moved out of the Path of Building folder (its Settings.xml is
-- never touched)
dofile(engineDir .. "/_SimpleGraphic.def.lua")
function GetVirtualScreenSize()
  return 1920, 1080
end
function GetUserPath()
  return userDir
end
function ConPrintf(fmt, ...)
  io.stderr:write(string.format(fmt, ...), "\n")
end

__callbackTable__ = {}
function runCallback(name, ...)
  if __callbackTable__[name] then
    return __callbackTable__[name](...)
  elseif __mainObject__ and __mainObject__[name] then
    return __mainObject__[name](__mainObject__, ...)
  end
end

local l_require = require
function require(name)
  -- no network access from here (update checks, imports)
  if name == "lcurl.safe" then
    return
  end
  return l_require(name)
end

dofile("Launch.lua")
__mainObject__.continuousIntegrationMode = nil
runCallback("OnInit")
runCallback("OnFrame")

local json = require("dkjson")

local function send(tbl)
  stdout:write(json.encode(tbl), "\n")
  stdout:flush()
end

if __mainObject__.promptMsg then
  send({ ok = false, error = "startup: " .. tostring(__mainObject__.promptMsg) })
  return
end

local buildLoaded = false
local build

-- as in HeadlessWrapper.lua
local function loadBuildFromXML(xmlText, name)
  if GlobalCache and GlobalCache.cachedData then
    wipeGlobalCache()
  end
  __mainObject__.main:SetMode("BUILD", false, name or "", xmlText)
  runCallback("OnFrame")
  build = __mainObject__.main.modes["BUILD"]
end

local STAT_KEYS = {
  "CombinedDPS", "TotalDPS", "TotalDot", "FullDPS", "Life", "EnergyShield", "Mana",
  "Spirit", "Armour", "Evasion", "FireResist", "ColdResist", "LightningResist",
  "ChaosResist", "MovementSpeedMod", "BlockChance",
  -- offence of the main skill
  "AverageDamage", "Speed", "CritChance", "CritMultiplier", "HitChance", "ManaCost",
  -- survival
  "TotalEHP", "PhysicalMaximumHitTaken", "FireMaximumHitTaken", "ColdMaximumHitTaken",
  "LightningMaximumHitTaken", "ChaosMaximumHitTaken", "PhysicalDamageReduction",
  "EvadeChance", "SpellBlockChance", "LifeRegenRecovery", "ManaRegenRecovery",
  -- attributes and their requirements
  "Str", "Dex", "Int", "ReqStr", "ReqDex", "ReqInt",
}

local function pickStats(output)
  local out = {}
  for _, key in ipairs(STAT_KEYS) do
    local v = output[key]
    if type(v) == "number" then
      out[key] = v
    end
  end
  return out
end

local function skillList()
  local list = {}
  for i, group in ipairs(build.skillsTab.socketGroupList) do
    list[#list + 1] = {
      index = i,
      label = group.displayLabel or group.label or ("#" .. i),
      enabled = group.enabled ~= false,
    }
  end
  return list
end

local function summary()
  local main = build.skillsTab.socketGroupList[build.mainSocketGroup]
  return {
    ok = true,
    className = build.spec and build.spec.curAscendClassName or nil,
    level = build.characterLevel,
    skills = skillList(),
    mainSkill = build.mainSocketGroup,
    mainSkillLabel = main and main.displayLabel or nil,
    stats = pickStats(build.calcsTab.mainOutput),
  }
end

local function selectSkillByName(name)
  if not name or name == "" then
    return
  end
  for i, group in ipairs(build.skillsTab.socketGroupList) do
    if (group.displayLabel or ""):lower():find(name:lower(), 1, true) then
      build.mainSocketGroup = i
      return
    end
  end
end

local handlers = {}

function handlers.load(req)
  loadBuildFromXML(req.xml, "overlay")
  selectSkillByName(req.skill)
  runCallback("OnFrame")
  buildLoaded = true
  return summary()
end

function handlers.skill(req)
  if not buildLoaded then
    return { ok = false, error = "no-build" }
  end
  local index = tonumber(req.index)
  if not index or not build.skillsTab.socketGroupList[index] then
    return { ok = false, error = "bad-skill" }
  end
  build.mainSocketGroup = index
  runCallback("OnFrame")
  return summary()
end

local function dpsOf(output)
  return output.CombinedDPS or output.TotalDPS or 0
end

-- DPS of every damaging skill of the build, before and with the new item
local function compareSkills(item, slotNames)
  local mainIndex = build.mainSocketGroup
  local perSlot = {}
  for _, slotName in ipairs(slotNames) do
    perSlot[slotName] = {}
  end
  local seen = {}
  for i, group in ipairs(build.skillsTab.socketGroupList) do
    local label = group.displayLabel
    if group.enabled ~= false and label and label ~= "" then
      build.mainSocketGroup = i
      build.buildFlag = true
      runCallback("OnFrame")
      local calcFunc = build.calcsTab:GetMiscCalculator()
      local before = dpsOf(calcFunc({}))
      for _, slotName in ipairs(slotNames) do
        local after = dpsOf(calcFunc({ repSlotName = slotName, repItem = item }))
        -- same skill twice in the build (other gems): keep the first
        local key = slotName .. "|" .. label .. "|" .. math.floor(before)
        if (before > 0 or after > 0) and not seen[key] then
          seen[key] = true
          table.insert(perSlot[slotName], {
            index = i,
            label = label,
            main = i == mainIndex,
            before = before,
            after = after,
          })
        end
      end
    end
  end
  build.mainSocketGroup = mainIndex
  build.buildFlag = true
  runCallback("OnFrame")
  return perSlot
end

function handlers.compare(req)
  if not buildLoaded then
    return { ok = false, error = "no-build" }
  end
  -- Path of Building 0.23+: new("Item"):Item(raw); before: new("Item", raw)
  local okOld, item = pcall(new, "Item", req.item)
  if not okOld then
    item = new("Item"):Item(req.item)
  end
  if not item.base then
    return { ok = false, error = "unknown-base" }
  end
  -- rings can go in either ring slot: compare with both, like Path of Building
  local primary = item:GetPrimarySlot()
  local slotNames = { primary }
  if primary == "Ring 1" then
    slotNames = { "Ring 1", "Ring 2" }
  end
  local calcFunc = build.calcsTab:GetMiscCalculator()
  local before = calcFunc({})
  local results = {}
  for _, slotName in ipairs(slotNames) do
    local slot = build.itemsTab.slots[slotName]
    local equipped = slot and build.itemsTab.items[slot.selItemId]
    local after = calcFunc({ repSlotName = slotName, repItem = item })
    results[#results + 1] = {
      slot = slotName,
      equipped = equipped and equipped.name or nil,
      after = pickStats(after),
    }
  end
  if req.allSkills ~= false then
    local perSlot = compareSkills(item, slotNames)
    for _, r in ipairs(results) do
      r.skills = perSlot[r.slot]
    end
  end
  return {
    ok = true,
    item = item.name,
    skill = (build.skillsTab.socketGroupList[build.mainSocketGroup] or {}).displayLabel,
    before = pickStats(before),
    results = results,
  }
end

send({ ok = true, ready = true })

for line in io.stdin:lines() do
  local req = json.decode(line)
  local answer
  if type(req) ~= "table" or not handlers[req.cmd] then
    answer = { ok = false, error = "bad-command" }
  else
    local ok, result = pcall(handlers[req.cmd], req)
    answer = ok and result or { ok = false, error = tostring(result) }
  end
  answer.id = type(req) == "table" and req.id or nil
  send(answer)
end
