import pandas as pd
import os
import json
from plotnine import *
import numpy as np
import sys
import re
import IPython

def parse_k6_results(text):
    data = text.split('==startresults==')[1].split('==endresults==')[0]
    return json.loads(data)['metrics']


def replace_outliers_with_iqr(df, column_name, multiplier=1.5):
    """
    Replace outliers using IQR method without trimming the minimum values.

    Parameters:
    df: pandas DataFrame
    column_name: name of the column to process
    multiplier: IQR multiplier (default 1.5)

    Returns:
    DataFrame with outliers replaced
    """

    # Calculate quartiles and IQR
    Q1 = df[column_name].quantile(0.25)
    Q3 = df[column_name].quantile(0.75)
    IQR = Q3 - Q1

    #lower_bound = Q1 - multiplier * IQR
    upper_bound = Q3 + multiplier * IQR

    df_processed = df.copy()

    df_processed[column_name] = np.where(
        df_processed[column_name] > upper_bound,
        upper_bound,
        df_processed[column_name]
    )

    return df_processed




def process_run(dir):
    print('** processing run at', dir)
    with open(f'{dir}/strapi-activitymonitor-metrics.jsonp') as f:
        lines = [json.loads(l) for l in f]
    df = pd.DataFrame.from_records(lines)
    df = replace_outliers_with_iqr(df, 'cpuEnergy')

    df.drop(df[df.containerName.map(lambda n: n not in ('strapi_blog', ))].index, inplace=True)

    df.drop(df[df.ts <= 0].index, inplace=True)
    df['time'] = df.ts - df.ts.min()
    p = ggplot(df) + aes(x='time', y='cpuEnergy') + geom_line() + theme_538()
    p.save(f'{dir}/strapi-cpuenergy.png')
    e_strapi = df.cpuEnergy.sum()
    #print('strapi cpu energy = %0.2f' %e_strapi)

    with open(f'{dir}/graphcl-activitymonitor-metrics.jsonp') as f:
        lines = [json.loads(l) for l in f]
    df = pd.DataFrame.from_records(lines)
    df = replace_outliers_with_iqr(df, 'cpuEnergy')

    df.drop(df[df.containerName.map(lambda n: not n.startswith('strapi_') and not n.startswith('strapi-graphcl'))].index, inplace=True)
    df.drop(df[df.ts <= 0].index, inplace=True)
    df['time'] = df.ts - df.ts.min()
    p = ggplot(df) + aes(x='time', y='cpuEnergy') + geom_line() + theme_538()
    p.save(f'{dir}/graphcl-cpuenergy.png')
    e_graphcl = df.cpuEnergy.sum()
    #print('graphcl cpu energy = %0.2f' %e_graphcl)

    # TODO capture http latency p95 and total number of requests

    with open(f'{dir}/strapi-k6-results.txt') as f:
        k6_strapi = parse_k6_results(f.read())

    with open(f'{dir}/graphcl-k6-results.txt') as f:
        k6_graphcl = parse_k6_results(f.read())

    return (e_strapi, k6_strapi), (e_graphcl, k6_graphcl)

def main():
    base = sys.argv[1]
    data = []
    for i in range(10):
        run_dir = f'{base}/{i + 1}'
        if not os.path.isdir(run_dir):
            break
        strapi, graphcl = process_run(run_dir)
        #print('run %i: %0.2f, %0.2f => %0.2f' %(i, e_strapi, e_graphcl, e_graphcl/e_strapi))
        data.append([
            strapi[1]['http_reqs']['values']['rate'],
            strapi[1]['http_req_duration']['values']['avg'],
            strapi[1]['http_req_duration']['values']['med'],
            strapi[1]['http_req_duration']['values']['p(95)'],
            strapi[0],
            graphcl[1]['http_reqs']['values']['rate'],
            graphcl[1]['http_req_duration']['values']['avg'],
            graphcl[1]['http_req_duration']['values']['med'],
            graphcl[1]['http_req_duration']['values']['p(95)'],
            graphcl[0],
        ])

    columns = [
        'baseline_http_rate',
        'baseline_http_duration_mean',
        'baseline_http_duration_median',
        'baseline_http_duration_p95',
        'baseline_cpu_energy',
        'graphcl_http_rate',
        'graphcl_http_duration_mean',
        'graphcl_http_duration_median',
        'graphcl_http_duration_p95',
        'graphcl_cpu_energy',
    ]
    summary = pd.DataFrame.from_records(data, columns=columns)

    out_fname = 'summary.csv'
    summary.to_csv(out_fname, index=False)

    print('Summary written to %s' %out_fname)


main()
