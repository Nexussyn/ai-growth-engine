#!/usr/bin/env python3
from math import ceil
from statistics import NormalDist

def approx_n_binary(p0: float, p1: float, alpha: float=1e-6, power: float=0.95) -> int:
    if not (0 < p0 < 1 and 0 < p1 < 1 and 0 < alpha < 1 and 0 < power < 1):
        raise ValueError("probabilities must be in (0,1)")
    z_alpha = NormalDist().inv_cdf(1-alpha/2)
    z_beta = NormalDist().inv_cdf(power)
    pbar = (p0+p1)/2
    num = z_alpha*(2*pbar*(1-pbar))**0.5 + z_beta*(p0*(1-p0)+p1*(1-p1))**0.5
    return ceil((num/(p1-p0))**2)

if __name__ == "__main__":
    for p1 in (0.26,0.27,0.30,0.35,0.40):
        print(p1, approx_n_binary(0.25,p1))
