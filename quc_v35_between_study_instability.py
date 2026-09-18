#!/usr/bin/env python3
"""Q-UC Ω V35: preregistered-style audit of between-study instability.

Uses only aggregate results published in the 2026 PLOS ONE AMP-TPP report.
This is a secondary analysis, not a new experiment.

Primary question:
Does Study 2's observed deviation differ from Study 3's observed deviation
more than expected from binomial sampling variation?

Study 2: 49.65%, N=127000
Study 3: 50.07%, N=217800
"""
from math import sqrt, log, exp

STUDIES = {
    "S1": (0.4948, 37836),
    "S2": (0.4965, 127000),
    "S3": (0.5007, 217800),
}

def two_sample_z(p1,n1,p2,n2):
    se=sqrt(p1*(1-p1)/n1+p2*(1-p2)/n2)
    return (p1-p2)/se, se

def log_odds(p):
    return log(p/(1-p))

def main():
    out={}
    for a,b in [("S1","S2"),("S2","S3"),("S1","S3")]:
        p1,n1=STUDIES[a]; p2,n2=STUDIES[b]
        z,se=two_sample_z(p1,n1,p2,n2)
        out[f"{a}_vs_{b}"]={
            "difference_percentage_points":100*(p1-p2),
            "SE_percentage_points":100*se,
            "z":z,
            "log_odds_difference":log_odds(p1)-log_odds(p2),
        }
    print(out)

if __name__=="__main__":
    main()
