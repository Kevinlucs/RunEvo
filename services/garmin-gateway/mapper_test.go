package main

import (
	"testing"

	"github.com/ndeloof/go-garmin/pkg/garmin"
)

func steps(workout *garmin.Workout) []garmin.WorkoutStep {
	if workout == nil || len(workout.WorkoutSegments) == 0 {
		return nil
	}
	return workout.WorkoutSegments[0].WorkoutSteps
}

func TestMapsSimpleDistanceWithZone(t *testing.T) {
	workout, err := mapRunEvoWorkout(RunEvoWorkout{ID: "1", Title: "Facil", Description: "6 km em Z2"})
	if err != nil {
		t.Fatalf("mapRunEvoWorkout: %v", err)
	}
	list := steps(workout)
	if len(list) != 1 {
		t.Fatalf("steps: %d, want 1", len(list))
	}
	step := list[0]
	if step.EndCondition == nil || step.EndCondition.ConditionTypeKey != "distance" {
		t.Fatalf("end condition: %+v", step.EndCondition)
	}
	if step.EndConditionValue == nil || *step.EndConditionValue != 6000 {
		t.Fatalf("endConditionValue: %v, want 6000", step.EndConditionValue)
	}
	if step.ZoneNumber == nil || *step.ZoneNumber != 2 {
		t.Fatalf("zoneNumber: %v, want 2", step.ZoneNumber)
	}
}

func TestMapsStructuredIntervalWorkout(t *testing.T) {
	description := "10 min aquecimento\n6x:\n400 m Z4\n200 m Z1/Z2\n10 min desaquecimento"
	workout, err := mapRunEvoWorkout(RunEvoWorkout{ID: "2", Title: "Intervalado", Description: description})
	if err != nil {
		t.Fatalf("mapRunEvoWorkout: %v", err)
	}
	list := steps(workout)
	if len(list) != 3 {
		t.Fatalf("steps: %d, want 3", len(list))
	}
	if list[0].StepType.StepTypeKey != "warmup" {
		t.Fatalf("first step: %s, want warmup", list[0].StepType.StepTypeKey)
	}
	if list[0].EndConditionValue == nil || *list[0].EndConditionValue != 600 {
		t.Fatalf("warmup seconds: %v, want 600", list[0].EndConditionValue)
	}
	group := list[1]
	if group.Type != garmin.StepTypeRepeatGroup {
		t.Fatalf("second step type: %s, want %s", group.Type, garmin.StepTypeRepeatGroup)
	}
	if group.NumberOfIterations == nil || *group.NumberOfIterations != 6 {
		t.Fatalf("iterations: %v, want 6", group.NumberOfIterations)
	}
	if len(group.WorkoutSteps) != 2 {
		t.Fatalf("children: %d, want 2", len(group.WorkoutSteps))
	}
	if group.WorkoutSteps[0].EndConditionValue == nil || *group.WorkoutSteps[0].EndConditionValue != 400 {
		t.Fatalf("fast segment: %v, want 400", group.WorkoutSteps[0].EndConditionValue)
	}
	if group.WorkoutSteps[0].ZoneNumber == nil || *group.WorkoutSteps[0].ZoneNumber != 4 {
		t.Fatalf("fast zone: %v, want 4", group.WorkoutSteps[0].ZoneNumber)
	}
	if group.WorkoutSteps[1].ZoneNumber != nil {
		t.Fatalf("Z1/Z2 range must not map to a single zone, got %v", *group.WorkoutSteps[1].ZoneNumber)
	}
	if list[2].StepType.StepTypeKey != "cooldown" {
		t.Fatalf("last step: %s, want cooldown", list[2].StepType.StepTypeKey)
	}
}

func TestMapsRecoveryAndAllZones(t *testing.T) {
	for zone := 1; zone <= 5; zone++ {
		line := "5 km em Z" + string(rune('0'+zone))
		step, ok := parseExecutable(line, 1)
		if !ok {
			t.Fatalf("parseExecutable(%q) failed", line)
		}
		if step.ZoneNumber == nil || *step.ZoneNumber != zone {
			t.Fatalf("zone for %q: %v, want %d", line, step.ZoneNumber, zone)
		}
	}
	step, ok := parseExecutable("5 min recuperação", 1)
	if !ok || step.StepType.StepTypeKey != "recovery" {
		t.Fatalf("recovery step: %+v ok=%v", step, ok)
	}
	if step.EndConditionValue == nil || *step.EndConditionValue != 300 {
		t.Fatalf("recovery seconds: %v, want 300", step.EndConditionValue)
	}
}

func TestFallsBackToPlannedKm(t *testing.T) {
	km := 10.0
	workout, err := mapRunEvoWorkout(RunEvoWorkout{ID: "3", Title: "Sem descricao", Description: "instruções livres", PlannedKM: &km})
	if err != nil {
		t.Fatalf("mapRunEvoWorkout: %v", err)
	}
	list := steps(workout)
	if len(list) != 1 {
		t.Fatalf("steps: %d, want 1", len(list))
	}
	if list[0].EndConditionValue == nil || *list[0].EndConditionValue != 10000 {
		t.Fatalf("endConditionValue: %v, want 10000", list[0].EndConditionValue)
	}
}

func TestRejectsWorkoutWithoutDurationOrDistance(t *testing.T) {
	if _, err := mapRunEvoWorkout(RunEvoWorkout{ID: "4", Title: "Vazio", Description: ""}); err == nil {
		t.Fatal("expected error for empty workout")
	}
}
