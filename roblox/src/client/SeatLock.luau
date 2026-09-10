--!nonstrict
-- SeatLock.luau -- P2 seated jump lock (client side).
-- The server only replicates the Player attribute "DigitDualSeatLocked";
-- Humanoid:SetStateEnabled does not replicate, so the jump has to be turned
-- off locally on the initial character and on every CharacterAdded.
-- Only the jump is touched: walking, camera and the rest of the input stay live.

local ContextActionService = game:GetService("ContextActionService")
local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local ATTRIBUTE = "DigitDualSeatLocked"
local ACTION_NAME = "DigitDualSeatLockJump"
local PRIORITY = Enum.ContextActionPriority.High.Value
local HUMANOID_WAIT = 10

local SeatLock = {}

-- start(player) -> cleanup(); cleanup is idempotent and restores the humanoid.
function SeatLock.start(player)
	player = player or Players.LocalPlayer

	local conns = {}           -- lives as long as start()
	local humanoidConns = {}   -- lives as long as the current humanoid
	local humanoid = nil
	local character = nil      -- character that owns `humanoid`; nil when detached
	local jumpWasEnabled = nil -- original GetStateEnabled(Jumping); nil = not captured
	local bound = false
	local stopped = false

	local function sink()
		return Enum.ContextActionResult.Sink
	end

	local function bind()
		if bound then
			return
		end
		bound = true
		-- createTouchButton = false: never add a button of our own on mobile.
		ContextActionService:BindActionAtPriority(ACTION_NAME, sink, false, PRIORITY, Enum.KeyCode.Space, Enum.KeyCode.ButtonA)
	end

	local function unbind()
		if not bound then
			return
		end
		bound = false
		ContextActionService:UnbindAction(ACTION_NAME)
	end

	local function locked()
		return player:GetAttribute(ATTRIBUTE) == true
	end

	local function applyToHumanoid()
		if not humanoid or humanoid.Parent == nil then
			return
		end
		if locked() then
			if jumpWasEnabled == nil then
				jumpWasEnabled = humanoid:GetStateEnabled(Enum.HumanoidStateType.Jumping)
			end
			humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping, false)
			humanoid.Jump = false
		elseif jumpWasEnabled ~= nil then
			humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping, jumpWasEnabled)
			jumpWasEnabled = nil
		end
	end

	local function refresh()
		if locked() then
			bind()
		else
			unbind()
		end
		applyToHumanoid()
	end

	local function releaseHumanoid()
		for _, c in humanoidConns do
			c:Disconnect()
		end
		table.clear(humanoidConns)
		if humanoid and humanoid.Parent and jumpWasEnabled ~= nil then
			humanoid:SetStateEnabled(Enum.HumanoidStateType.Jumping, jumpWasEnabled)
		end
		jumpWasEnabled = nil
		humanoid = nil
		character = nil
	end

	-- true once `char` is no longer the character we should be locking
	local function stale(char)
		return stopped or char == nil or char.Parent == nil or player.Character ~= char
	end

	local function attach(char)
		-- stale guard runs *before* any release: a queued callback for an old
		-- character must never tear down the lock on the current one
		if stale(char) then
			return
		end
		local hum = char:FindFirstChildOfClass("Humanoid")
		if not hum then
			hum = char:WaitForChild("Humanoid", HUMANOID_WAIT)
			if stale(char) then -- re-check: the character may have been replaced while we waited
				return
			end
		end
		if not hum then
			return
		end
		if humanoid == hum then
			-- initial task.spawn / CharacterAdded overlap: keep the captured
			-- jumpWasEnabled and the existing listeners, just re-apply
			applyToHumanoid()
			return
		end
		releaseHumanoid()
		humanoid = hum
		character = char
		-- JumpRequest covers the mobile jump button and any other jump source.
		table.insert(humanoidConns, UserInputService.JumpRequest:Connect(function()
			if humanoid == hum and locked() then
				hum.Jump = false
			end
		end))
		table.insert(humanoidConns, hum:GetPropertyChangedSignal("Jump"):Connect(function()
			if humanoid == hum and hum.Jump and locked() then
				hum.Jump = false
			end
		end))
		table.insert(humanoidConns, hum.AncestryChanged:Connect(function()
			if humanoid == hum and hum.Parent == nil then
				releaseHumanoid()
			end
		end))
		applyToHumanoid()
	end

	table.insert(conns, player:GetAttributeChangedSignal(ATTRIBUTE):Connect(refresh))
	table.insert(conns, player.CharacterAdded:Connect(attach))
	table.insert(conns, player.CharacterRemoving:Connect(function(char)
		if char == character then -- a late removal for an old character is a no-op
			releaseHumanoid()
		end
	end))

	if player.Character then
		task.spawn(attach, player.Character) -- initial character; do not block start()
	end
	refresh()

	return function()
		if stopped then
			return
		end
		stopped = true
		for _, c in conns do
			c:Disconnect()
		end
		table.clear(conns)
		unbind()
		releaseHumanoid()
	end
end

return SeatLock
