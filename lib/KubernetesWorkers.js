const cdk = require('@aws-cdk/core');
const ec2 = require('@aws-cdk/aws-ec2');
const iam = require('@aws-cdk/aws-iam');

class KubernetesWorkers extends cdk.Construct {
    constructor(scope, id, { vpc, securityGroup, instances, subnet }) {
        super(scope, id);

        const role = new iam.Role(this, 'Kubernetes Workers Role', {
            assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
        });

        this.instances = new Array(instances)
            .fill(undefined)
            .map((_, i) => new ec2.Instance(this, `Kubernetes Worker ${i}`, {
                keyName: 'macbook-air-personal',
                vpc,
                instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
                machineImage: ec2.MachineImage.latestAmazonLinux({
                    generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
                }),
                instanceName: `kubernetes-worker-${i}`,
                blockDevices: [
                    {
                        deviceName: '/dev/xvda',
                        volume: ec2.BlockDeviceVolume.ebs(200),
                    }
                ],
                role,
                securityGroup,
                vpcSubnets: subnet,
            })
        )

        this.instances.map((instance, i) => {
            instance.addUserData(`echo 10.200.${i}.0/24 > /etc/podCidr.txt`)
        });
    }
}

module.exports = KubernetesWorkers;