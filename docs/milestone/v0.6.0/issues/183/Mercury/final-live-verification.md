# #183 revised MCP helper live verification

2026-09-11 07:00 UTC · Mercury 직접 실행. Mars_4 수정 완료 후 실행했으며 에이전트에 노출된 MCP 도구 호출과 Node stdio 점검을 구분한다. 실제 새 Codex·Claude 호출 증거는 각각 별도 검수 문서에 있다.

```powershell
node tools/unity/mcp_smoke.js --unity-bin "C:/Users/pc_77/AppData/Local/Unity/bin/unity.exe" --project-path "C:/Users/pc_77/orca/Digit-Duel/unity" --timeout 15000
```

- 종료0, initialize OK: unity-mcp1.0.0-beta.9 / protocol2024-11-05.
- tools/list149개, editor_status 응답 isError=false.
- projectPath는 위 Digit-Duel/unity, unityVersion6000.6.0f1.
- ready, compiling=false, domainReloadInProgress=false, playMode=stopped.
- 강화된 initialize 필수 필드·도구 기능 확인이 실제 서버와 호환된다. UTF-8 분할/timeout 경계는 격리 회귀로 검증했고 실제 서버 응답이 그런 경계를 발생시켰다고 주장하지 않는다.
- Mercury는 같은 수정본의 node --test 회귀46/46을 독립 실행했다. 다중 Editor와 임시 scene 변경/복구는 Mars_2의 별도 실행 증거로 판정한다.

## 실제 에이전트 변경·복구와 다중 Editor

Mars_2 `msg_36d95491eed7`(07:10 UTC): 실제 Claude MCP로 primary의 `Assets/_CliSmoke/McpProbe.unity`와 `McpProbeObject`를 만들고 hierarchy에서 확인했다. Boot scene을 다시 연 뒤 임시 폴더를 제거했고 Unity145파일 지문은 이전과 같았다. 임시 파일 잔여물0. 별도의 실제 Git checkout Editor와 동시에 실행 중에도 Claude MCP는 고정된 primary를 선택했다. 앞선 SecondaryProbe 대조(Atlas1개 대0개)와 함께 대상 선택을 확인한다. 이는 Claude의 변경 증거이며 READ_ONLY인 Saturn/Codex가 scene을 변경한 것으로 표현하지 않는다.
