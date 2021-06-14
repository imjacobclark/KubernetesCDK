const cdk = require('@aws-cdk/core');
const ec2 = require('@aws-cdk/aws-ec2');
const KubernetesControlPlane = require('./KubernetesControlPlane');
const KubernetesWorkers = require('./KubernetesWorkers');
const { SubnetType } = require('@aws-cdk/aws-ec2');

class KubernetesVPC extends cdk.Construct {
  constructor(scope, id, { cidr }) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, id, {
      cidr,
      maxAzs: 1,
      subnetConfiguration: [{
        cidrMask: 24,
        name: 'Kubernetes Private Subnet',
        subnetType: SubnetType.PRIVATE,
      },
      {
        cidrMask: 24,
        name: 'Kubernetes Public Subnet',
        subnetType: SubnetType.PUBLIC,
      }]
    });
  }
}

class KubernetesSecurityGroup extends cdk.Construct {
  constructor(scope, id, { vpc, ingressRules, egressRules }) {
    super(scope, id);

    this.sg = new ec2.SecurityGroup(this, id, {
      vpc,
      allowAllOutbound: true
    });

    ingressRules.forEach(rule => this.sg.addIngressRule(rule.peer, rule.port, rule.description))
    egressRules.forEach(rule => this.sg.addEgressRule(rule.peer, rule.port, rule.description))
  }
}

class KubernetesFromScratchCdkStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const vpc = new KubernetesVPC(this, "Kubernetes VPC", { cidr: '10.240.0.0/16' })

    const sg = new KubernetesSecurityGroup(this, "Kubernetes Security Group", {
      vpc: vpc.vpc,
      ingressRules: [
        {
          peer: ec2.Peer.ipv4("10.240.0.0/16"),
          port: ec2.Port.allTraffic(),
          description: "All internal traffic"
        },
        {
          peer: ec2.Peer.ipv4("10.200.0.0/22"),
          port: ec2.Port.allTraffic(),
          description: "All internal traffic"
        },
        {
          peer: ec2.Peer.ipv4("0.0.0.0/0"),
          port: ec2.Port.tcp(22),
          description: "All SSH external traffic"
        },
        {
          peer: ec2.Peer.ipv4("0.0.0.0/0"),
          port: ec2.Port.tcp(6443),
          description: "All HTTPS external traffic"
        },
        {
          peer: ec2.Peer.ipv4("0.0.0.0/0"),
          port: ec2.Port.allIcmp(),
          description: "All ICMP external traffic"
        }
      ],
      egressRules: []
    });

    const eip = new ec2.CfnEIP(this, 'Kubernetes Elastic IP');

    const kubernetesControlPlane = new KubernetesControlPlane(this, 'Kubernetes Control Plane', {
      instances: 3,
      vpc: vpc.vpc,
      securityGroup: sg.sg,
      subnet: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });

    const kubernetesWorkers = new KubernetesWorkers(this, 'Kubernetes Workers', {
      instances: 3,
      vpc: vpc.vpc,
      securityGroup: sg.sg,
      subnet: {
        subnetType: ec2.SubnetType.PUBLIC
      }
    });
  }
}

module.exports = { KubernetesFromScratchCdkStack }
