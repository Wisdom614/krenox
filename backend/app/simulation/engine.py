import random
import simpy
import numpy as np
from typing import Dict, Any

def run_queue_simulation(
    num_customers: int = 60,
    arrival_interval_mins: float = 3.0,
    service_duration_mins: float = 12.0,
    num_counters: int = 3,
    transit_time_mins: float = 3.5,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Discrete-Event Simulation evaluating Conventional vs. Krenox Virtual Queue.
    Adheres strictly to §7.4 & §7.5 of Product Documentation:
    - Same arrival distribution (Poisson process / exponential inter-arrivals).
    - Same service time distribution (log-normal / exponential).
    - Identical random seed to ensure fair, controlled comparison.
    - Accurately separates Total Waiting Time from Physical In-Room Waiting Time.
    """
    np.random.seed(random_seed)
    random.seed(random_seed)

    # Pre-generate arrival intervals and service times for exact consistency between both runs
    inter_arrivals = np.random.exponential(scale=arrival_interval_mins, size=num_customers).tolist()
    service_times = np.random.exponential(scale=service_duration_mins, size=num_customers).tolist()

    # ─────────────────────────────────────────────────────────────
    # SCENARIO A: CONVENTIONAL PHYSICAL QUEUE
    # Customers must stand physically in the room from arrival until served.
    # ─────────────────────────────────────────────────────────────
    env_conv = simpy.Environment()
    counters_conv = simpy.Resource(env_conv, capacity=num_counters)

    conv_wait_times = []
    conv_physical_waits = []
    conv_queue_lengths = []
    conv_service_busy_time = 0.0

    def customer_conventional(env, cid, stime):
        nonlocal conv_service_busy_time
        arrival_time = env.now
        conv_queue_lengths.append(len(counters_conv.queue))

        with counters_conv.request() as req:
            yield req
            start_service = env.now
            wait_time = start_service - arrival_time
            conv_wait_times.append(wait_time)
            # In conventional physical queues, physical wait == total wait!
            conv_physical_waits.append(wait_time)

            conv_service_busy_time += stime
            yield env.timeout(stime)

    def arrival_generator_conv(env):
        for cid in range(num_customers):
            yield env.timeout(inter_arrivals[cid])
            env.process(customer_conventional(env, cid, service_times[cid]))

    env_conv.process(arrival_generator_conv(env_conv))
    env_conv.run()
    sim_duration_conv = env_conv.now

    # ─────────────────────────────────────────────────────────────
    # SCENARIO B: KRENOX VIRTUAL QUEUE
    # Customers join digitally. They wait remotely (library, dorm, cafeteria)
    # and only walk over when notified, reducing physical hallway wait to transit time!
    # ─────────────────────────────────────────────────────────────
    env_v = simpy.Environment()
    counters_v = simpy.Resource(env_v, capacity=num_counters)

    v_wait_times = []
    v_physical_waits = []
    v_queue_lengths = []
    v_service_busy_time = 0.0

    def customer_virtual(env, cid, stime):
        nonlocal v_service_busy_time
        arrival_time = env.now
        v_queue_lengths.append(len(counters_v.queue))

        with counters_v.request() as req:
            yield req
            start_service = env.now
            total_wait = start_service - arrival_time
            v_wait_times.append(total_wait)

            # In Krenox Virtual Queue:
            # Physical presence is restricted solely to the transit walking window (e.g. 2-4 mins)
            # or the total wait if the queue moved faster than transit time!
            physical_wait = min(total_wait, transit_time_mins)
            v_physical_waits.append(physical_wait)

            v_service_busy_time += stime
            yield env.timeout(stime)

    def arrival_generator_v(env):
        for cid in range(num_customers):
            yield env.timeout(inter_arrivals[cid])
            env.process(customer_virtual(env, cid, service_times[cid]))

    env_v.process(arrival_generator_v(env_v))
    env_v.run()
    sim_duration_v = env_v.now

    # ─────────────────────────────────────────────────────────────
    # METRICS CALCULATION (Product Documentation §7.5)
    # ─────────────────────────────────────────────────────────────
    conv_avg_wait = float(np.mean(conv_wait_times)) if conv_wait_times else 0.0
    conv_max_wait = float(np.max(conv_wait_times)) if conv_wait_times else 0.0
    conv_avg_physical = float(np.mean(conv_physical_waits)) if conv_physical_waits else 0.0
    conv_utilization = float((conv_service_busy_time / (sim_duration_conv * num_counters)) * 100) if sim_duration_conv > 0 else 0.0

    v_avg_wait = float(np.mean(v_wait_times)) if v_wait_times else 0.0
    v_max_wait = float(np.max(v_wait_times)) if v_wait_times else 0.0
    v_avg_physical = float(np.mean(v_physical_waits)) if v_physical_waits else 0.0
    v_utilization = float((v_service_busy_time / (sim_duration_v * num_counters)) * 100) if sim_duration_v > 0 else 0.0

    # Physical Waiting Time Reduction % formula:
    # ((Baseline Physical Wait - Virtual Physical Wait) / Baseline Physical Wait) * 100
    reduction_pct = 0.0
    if conv_avg_physical > 0:
        reduction_pct = float(((conv_avg_physical - v_avg_physical) / conv_avg_physical) * 100)

    return {
        "parameters": {
            "num_customers": num_customers,
            "arrival_interval_mins": arrival_interval_mins,
            "service_duration_mins": service_duration_mins,
            "num_counters": num_counters,
            "transit_time_mins": transit_time_mins,
        },
        "conventional": {
            "avg_total_wait_mins": round(conv_avg_wait, 2),
            "max_wait_mins": round(conv_max_wait, 2),
            "avg_physical_wait_mins": round(conv_avg_physical, 2),
            "counter_utilization_pct": round(min(conv_utilization, 100.0), 1),
            "avg_queue_length": round(float(np.mean(conv_queue_lengths)), 1) if conv_queue_lengths else 0.0,
            "total_served": len(conv_wait_times),
            "duration_hours": round(sim_duration_conv / 60.0, 2),
        },
        "virtual": {
            "avg_total_wait_mins": round(v_avg_wait, 2),
            "max_wait_mins": round(v_max_wait, 2),
            "avg_physical_wait_mins": round(v_avg_physical, 2),
            "counter_utilization_pct": round(min(v_utilization, 100.0), 1),
            "avg_queue_length": round(float(np.mean(v_queue_lengths)), 1) if v_queue_lengths else 0.0,
            "total_served": len(v_wait_times),
            "duration_hours": round(sim_duration_v / 60.0, 2),
        },
        "reduction": {
            "physical_wait_reduction_pct": round(max(reduction_pct, 0.0), 1),
            "minutes_saved_physically_per_student": round(max(conv_avg_physical - v_avg_physical, 0.0), 2),
        },
    }
