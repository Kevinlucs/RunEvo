package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/ndeloof/go-garmin/pkg/garmin"
)

type RunEvoWorkout struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	PlannedKM   *float64 `json:"planned_km"`
	PlannedPace *string  `json:"planned_pace"`
}

var (
	repeatLine    = regexp.MustCompile(`(?i)^\s*(\d+)\s*x\s*:?\s*$`)
	distanceValue = regexp.MustCompile(`(?i)(\d+(?:[.,]\d+)?)\s*(km|quil[oô]metros?|m)\b`)
	timeValue     = regexp.MustCompile(`(?i)(\d+)\s*(min(?:utos?)?|h(?:oras?)?|seg(?:undos?)?|s)\b`)
	zoneValue     = regexp.MustCompile(`(?i)\bz([1-5])\b`)
)

func mapRunEvoWorkout(input RunEvoWorkout) (*garmin.Workout, error) {
	name := strings.TrimSpace(input.Title)
	if name == "" {
		name = "Treino RunEvo"
	}
	steps := parseWorkoutLines(input.Description)
	if len(steps) == 0 && input.PlannedKM != nil && *input.PlannedKM > 0 {
		steps = []garmin.WorkoutStep{executableStep(1, garmin.StepInterval, *input.PlannedKM*1000, true, 0, "")}
	}
	if len(steps) == 0 {
		return nil, fmt.Errorf("workout sem duração ou distância")
	}
	return &garmin.Workout{
		WorkoutName: name,
		Description: strings.TrimSpace(input.Description),
		SportType:   garmin.SportRunning,
		WorkoutSegments: []garmin.WorkoutSegment{{
			SegmentOrder: 1, SportType: garmin.SportRunning, WorkoutSteps: steps,
		}},
	}, nil
}

func parseWorkoutLines(description string) []garmin.WorkoutStep {
	lines := strings.Split(strings.ReplaceAll(description, "\r\n", "\n"), "\n")
	steps := make([]garmin.WorkoutStep, 0, len(lines))
	order := 1
	for index := 0; index < len(lines); index++ {
		line := strings.TrimSpace(lines[index])
		if line == "" {
			continue
		}
		if match := repeatLine.FindStringSubmatch(line); len(match) == 2 {
			repetitions, _ := strconv.Atoi(match[1])
			children := make([]garmin.WorkoutStep, 0, 2)
			for index+1 < len(lines) && len(children) < 2 {
				index++
				childLine := strings.TrimSpace(lines[index])
				if childLine == "" {
					continue
				}
				step, ok := parseExecutable(childLine, len(children)+1)
				if ok {
					children = append(children, step)
				}
			}
			if repetitions > 0 && len(children) > 0 {
				steps = append(steps, garmin.WorkoutStep{
					Type: garmin.StepTypeRepeatGroup, StepOrder: order, StepType: garmin.StepRepeat,
					NumberOfIterations: garmin.Int(repetitions), WorkoutSteps: children,
				})
				order++
			}
			continue
		}
		if step, ok := parseExecutable(line, order); ok {
			steps = append(steps, step)
			order++
		}
	}
	return steps
}

func parseExecutable(line string, order int) (garmin.WorkoutStep, bool) {
	lower := strings.ToLower(line)
	stepType := garmin.StepInterval
	switch {
	case strings.Contains(lower, "desaquec") || strings.Contains(lower, "cooldown"):
		stepType = garmin.StepCooldown
	case strings.Contains(lower, "aquec") || strings.Contains(lower, "warm"):
		stepType = garmin.StepWarmup
	case strings.Contains(lower, "recuper") || strings.Contains(lower, "recovery"):
		stepType = garmin.StepRecovery
	}
	if match := distanceValue.FindStringSubmatch(lower); len(match) == 3 {
		value, err := strconv.ParseFloat(strings.ReplaceAll(match[1], ",", "."), 64)
		if err != nil || value <= 0 {
			return garmin.WorkoutStep{}, false
		}
		if strings.HasPrefix(match[2], "k") || strings.HasPrefix(match[2], "q") {
			value *= 1000
		}
		return executableStep(order, stepType, value, true, zoneFromLine(lower), line), true
	}
	if match := timeValue.FindStringSubmatch(lower); len(match) == 3 {
		value, err := strconv.ParseFloat(match[1], 64)
		if err != nil || value <= 0 {
			return garmin.WorkoutStep{}, false
		}
		switch match[2][0] {
		case 'h':
			value *= 3600
		case 'm':
			value *= 60
		}
		return executableStep(order, stepType, value, false, zoneFromLine(lower), line), true
	}
	return garmin.WorkoutStep{}, false
}

func executableStep(order int, stepType garmin.WorkoutStepType, value float64, distance bool, zone int, description string) garmin.WorkoutStep {
	condition := garmin.EndTime
	if distance {
		condition = garmin.EndDistance
	}
	step := garmin.WorkoutStep{
		Type: garmin.StepTypeExecutable, StepOrder: order, StepType: stepType,
		EndCondition: &condition, EndConditionValue: garmin.Float64(value), Description: description,
	}
	if zone >= 1 && zone <= 5 {
		target := garmin.TargetPaceZone
		step.TargetType = &target
		step.ZoneNumber = garmin.Int(zone)
	}
	return step
}

func zoneFromLine(line string) int {
	// Z1/Z2 é uma faixa textual do plano. Não a convertemos em BPM, nem em uma
	// zona única. O trecho continua na descrição Garmin sem target prescritivo.
	if strings.Contains(line, "/") {
		return 0
	}
	match := zoneValue.FindStringSubmatch(line)
	if len(match) != 2 {
		return 0
	}
	zone, _ := strconv.Atoi(match[1])
	return zone
}

func decodeWorkout(raw json.RawMessage) (RunEvoWorkout, error) {
	var workout RunEvoWorkout
	if err := json.Unmarshal(raw, &workout); err != nil {
		return RunEvoWorkout{}, err
	}
	if workout.ID == "" {
		return RunEvoWorkout{}, fmt.Errorf("workout sem id")
	}
	return workout, nil
}
