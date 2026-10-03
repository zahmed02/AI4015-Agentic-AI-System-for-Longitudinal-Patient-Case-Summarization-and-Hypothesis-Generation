"""
Unit tests for agent output shapes and control-flow logic — these do NOT
call real LLMs (no API quota burned), they test the parsing/routing logic
that wraps the LLM calls.
"""
import pytest
from src.agents.critic_agent import _parse_verdict
from src.agents.diagnostician_agent import _parse_hypotheses
from src.graph.workflow import route_after_critic


def test_parse_verdict_well_formed():
    raw = '{"approved": true, "issues": [], "feedback": "ok", "revision_target": "none"}'
    verdict = _parse_verdict(raw)
    assert verdict["approved"] is True
    assert verdict["revision_target"] == "none"


def test_parse_verdict_invalid_target_falls_back_to_none():
    raw = '{"approved": false, "issues": ["x"], "feedback": "f", "revision_target": "bogus"}'
    verdict = _parse_verdict(raw)
    assert verdict["revision_target"] == "none"


def test_parse_verdict_approved_forces_target_none():
    raw = '{"approved": true, "issues": [], "feedback": "f", "revision_target": "diagnostician"}'
    verdict = _parse_verdict(raw)
    assert verdict["revision_target"] == "none"


def test_parse_hypotheses_sorts_by_confidence():
    raw = '''[
        {"diagnosis": "B", "confidence": 0.3, "evidence": [], "reasoning": "r", "citations": []},
        {"diagnosis": "A", "confidence": 0.9, "evidence": [], "reasoning": "r", "citations": []}
    ]'''
    hyps = _parse_hypotheses(raw)
    assert hyps[0]["diagnosis"] == "A"
    assert hyps[1]["diagnosis"] == "B"


def test_route_after_critic_approved_ends():
    state = {"critic_approved": True, "iteration": 1, "max_iterations": 3}
    assert route_after_critic(state) == "__end__"


def test_route_after_critic_max_iterations_ends_even_if_not_approved():
    state = {"critic_approved": False, "iteration": 3, "max_iterations": 3,
              "revision_target": "diagnostician"}
    assert route_after_critic(state) == "__end__"


def test_route_after_critic_routes_to_diagnostician():
    state = {"critic_approved": False, "iteration": 1, "max_iterations": 3,
              "revision_target": "diagnostician"}
    assert route_after_critic(state) == "diagnostician"


def test_route_after_critic_routes_to_historian():
    state = {"critic_approved": False, "iteration": 1, "max_iterations": 3,
              "revision_target": "historian"}
    assert route_after_critic(state) == "historian"