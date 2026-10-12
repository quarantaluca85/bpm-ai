# Writing the diagram layout (BPMNDI) by hand

Read this only when the diagram must show something auto layout cannot draw: **pools, lanes, message flows, text annotations or groups** (or an expanded sub-process). In every other case, omit the layout and let the app generate it.

When you write a layout, it has to be **complete**: every drawable element needs a shape or edge. If a task, event, gateway or sequence flow is missing one, the app throws away all your coordinates and re-lays out the diagram, which also removes the pools and lanes you wanted. The validator's `LAYOUT` line should say `Complete`.

## Structure

```xml
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ...>
  ... collaboration / process ...
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">  <!-- or the process id if there are no pools -->
      <bpmndi:BPMNShape id="X_di" bpmnElement="X"> <dc:Bounds x=".." y=".." width=".." height=".." /> </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F_di" bpmnElement="F"> <di:waypoint x=".." y=".." /> <di:waypoint x=".." y=".." /> </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

- The plane's `bpmnElement` is the **collaboration** id when there are pools, otherwise the process id. If it points at the process, pools are not drawn.
- `Bounds` give the top-left corner plus the size. Coordinates are in pixels, with y pointing down.
- Waypoints run from the edge of the source shape to the edge of the target shape. Use right-angle bends (equal x or equal y between consecutive points) so the diagram reads cleanly.
- Order inside the plane: pools first, then lanes, then flow nodes, then edges. Later entries draw on top.

## Standard sizes

| Element | width × height | Notes |
|---|---|---|
| Events (start, end, intermediate, boundary) | 36 × 36 | |
| Tasks, collapsed sub-process, call activity | 100 × 80 | |
| Gateways | 50 × 50 | Add `isMarkerVisible="true"` on exclusive gateways to show the X |
| Pool (`participant`) | any | `isHorizontal="true"`; the first 30 px on the left hold the pool name |
| Lane | pool width − 30 × lane height | `isHorizontal="true"`, starts at pool x + 30 |
| Text annotation | about 100–150 × 30–50 | |

Spacing that reads well: about 50 px of gap between neighbouring shapes, and 120–150 px per lane. Centre each element vertically in its lane: element y = lane centre − height / 2.

Event and gateway labels sit below the shape. You can leave out `<bpmndi:BPMNLabel>` and bpmn-js will place it.

## Worked example: one pool, two lanes, an annotation

Validated and rendered with this app.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Claim" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Pool_Company" name="Company" processRef="Process_Claim" />
  </bpmn:collaboration>
  <bpmn:process id="Process_Claim" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Employee" name="Employee">
        <bpmn:flowNodeRef>Start_Need</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Submit</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_Manager" name="Manager">
        <bpmn:flowNodeRef>Task_Approve</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_Approved</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_Need" name="Expense incurred" />
    <bpmn:userTask id="Task_Submit" name="Submit claim" />
    <bpmn:userTask id="Task_Approve" name="Approve claim" />
    <bpmn:endEvent id="End_Approved" name="Claim approved" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_Need" targetRef="Task_Submit" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_Submit" targetRef="Task_Approve" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_Approve" targetRef="End_Approved" />
    <bpmn:textAnnotation id="Note_Limit"><bpmn:text>Over 500 EUR needs a second approver</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="Assoc_1" sourceRef="Task_Approve" targetRef="Note_Limit" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Pool_Company_di" bpmnElement="Pool_Company" isHorizontal="true">
        <dc:Bounds x="120" y="80" width="700" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Employee_di" bpmnElement="Lane_Employee" isHorizontal="true">
        <dc:Bounds x="150" y="80" width="670" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Manager_di" bpmnElement="Lane_Manager" isHorizontal="true">
        <dc:Bounds x="150" y="230" width="670" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_Need_di" bpmnElement="Start_Need">
        <dc:Bounds x="200" y="137" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Submit_di" bpmnElement="Task_Submit">
        <dc:Bounds x="290" y="115" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_di" bpmnElement="Task_Approve">
        <dc:Bounds x="440" y="265" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Approved_di" bpmnElement="End_Approved">
        <dc:Bounds x="602" y="287" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Note_Limit_di" bpmnElement="Note_Limit">
        <dc:Bounds x="600" y="110" width="150" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="236" y="155" />
        <di:waypoint x="290" y="155" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="390" y="155" />
        <di:waypoint x="490" y="155" />
        <di:waypoint x="490" y="265" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="540" y="305" />
        <di:waypoint x="602" y="305" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Assoc_1_di" bpmnElement="Assoc_1">
        <di:waypoint x="540" y="280" />
        <di:waypoint x="640" y="160" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
```

## Several pools and message flows

- Add one `participant` per pool, each with its own `processRef`, and give each pool its own horizontal band (for example y = 80 and y = 420). Leave about 40 px between bands.
- A pool whose inside you don't want to show (an external party) can be a `participant` with no `processRef`: it is just a labelled box.
- `messageFlow` belongs in the `collaboration`, with `sourceRef`/`targetRef` set to elements in **different** pools (or to the pools themselves). Draw it as a `BPMNEdge`, usually a vertical line between the pools.
